// backend/routes/bookings.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Booking = require('../models/booking');
const Schedule = require('../models/schedule');
const Vehicle = require('../models/vehicle');
const { initiateSTKPush } = require('../utils/mpesa'); // MPESA DARAJA
const mongoose = require('mongoose');

const formatPhone = (raw) => {
  if (!raw) return null;
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length === 10) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `254${cleaned}`;
  return null;
};

const assignNextAvailableSeat = async (scheduleId, session) => {
  const schedule = await Schedule.findById(scheduleId).session(session);
  if (!schedule) throw new Error('Schedule not found');

  const capacity = schedule.vehicle?.capacity || 14;

  for (let seat = 1; seat <= capacity; seat++) {
    const result = await Booking.findOneAndUpdate(
      { schedule: scheduleId, seatNumber: seat },
      {
        $setOnInsert: {
          schedule: scheduleId,
          seatNumber: seat,
          status: 'temp_reserved',
          passenger: null,
          reservedAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );

    if (result.status === 'temp_reserved') {
      return { seatNumber: seat, tempBookingId: result._id };
    }
  }

  throw new Error('No seats available — matatu is full');
};

// === INITIATE PAYMENT + TEMP RESERVE SEAT (MPESA DARAJA) ===
router.post('/initiate', auth, roleCheck(['passenger']), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let tempBookingId;

  try {
    const { scheduleId, phone: rawPhone, pickup, dropoff } = req.body;
    if (!scheduleId || !rawPhone || !pickup || !dropoff) {
      return res.status(400).json({ message: 'scheduleId, phone, pickup, and dropoff are required' });
    }

    const phone = formatPhone(rawPhone);
    if (!phone) return res.status(400).json({ message: 'Invalid phone number. Use 2547... or 07...' });

    // 1. GET SCHEDULE + ROUTE
    const schedule = await Schedule.findById(scheduleId)
      .populate({ path: 'route', populate: { path: 'stops' } })
      .populate('vehicle')
      .populate('sacco', 'name');

    if (!schedule || !schedule.isActive) {
      return res.status(400).json({ message: 'Schedule not available' });
    }

    const route = schedule.route;
    if (!route.stops || route.stops.length < 2) {
      return res.status(400).json({ message: 'Route has no stops defined' });
    }

    // 2. VALIDATE PICKUP & DROPOFF
    const pickupStop = route.stops.find(s => s.name === pickup);
    const dropoffStop = route.stops.find(s => s.name === dropoff);

    if (!pickupStop || !dropoffStop || pickupStop.order >= dropoffStop.order) {
      return res.status(400).json({ message: 'Invalid pickup or dropoff' });
    }

    // 3. CALCULATE SEGMENT FARE
    const segmentFare = dropoffStop.fareFromStart - pickupStop.fareFromStart;
    const developerFee = 2;
    const totalAmount = segmentFare + developerFee;

    // 4. CHECK SEAT AVAILABILITY PER SEGMENT
    for (let i = pickupStop.order; i < dropoffStop.order; i++) {
      const fromStop = route.stops[i - 1].name;
      const toStop = route.stops[i].name;

      const occupied = await Booking.countDocuments({
        schedule: scheduleId,
        'segment.pickup': fromStop,
        'segment.dropoff': toStop,
        status: 'confirmed'
      }).session(session);

      const capacity = schedule.vehicle?.capacity || 14;
      if (occupied >= capacity) {
        return res.status(400).json({ message: `No seats from ${fromStop} to ${toStop}` });
      }
    }

    // 5. TEMP RESERVE SEAT
    const { seatNumber, tempBookingId: bookingId } = await assignNextAvailableSeat(scheduleId, session);
    tempBookingId = bookingId;

    // 6. UPDATE BOOKING WITH SEGMENT + SACCO + SPLIT
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: 'pending_payment',
        passenger: req.user._id,
        sacco: schedule.sacco._id,
        totalAmount,
        saccoAmount: segmentFare,
        developerFee,
        reservedAt: undefined,
        segment: {
          pickup,
          dropoff,
          fare: segmentFare
        }
      },
      { session }
    );

    // 7. MPESA DARAJA STK PUSH
    const mpesaRes = await initiateSTKPush(phone, totalAmount, bookingId.toString());

    // 8. COMMIT
    await session.commitTransaction();

    return res.json({
      message: `Pay KES ${totalAmount} for ${pickup} to ${dropoff} + KES 2 fee`,
      seatNumber,
      bookingId,
      phone,
      checkoutId: mpesaRes.CheckoutRequestID,
      totalAmount,
      saccoAmount: segmentFare,
      developerFee,
      pickup,
      dropoff,
      segmentFare
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('Booking initiation failed:', err.message);

    if (err.response?.data) {
      console.error('MPesa Error:', err.response.data);
    }

    if (tempBookingId) {
      try { await Booking.findByIdAndDelete(tempBookingId); }
      catch (cleanupErr) { console.warn('Cleanup failed:', cleanupErr.message); }
    }

    return res.status(500).json({ 
      message: err.response?.data?.errorMessage || err.message || 'Payment failed' 
    });
  } finally {
    session.endSession();
  }
});

// === BOOKING CONFIRMED (CALL FROM MPESA CALLBACK) ===
router.post('/confirm', async (req, res) => {
  const { bookingId, status } = req.body;
  const io = req.app.get('io');
  const freeVehicleAndAssignNext = req.app.get('freeVehicleAndAssignNext');

  if (status !== 'COMPLETE') {
    return res.json({ message: 'Payment failed' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking || booking.status !== 'pending_payment') {
      throw new Error('Invalid or already processed booking');
    }

    const schedule = await Schedule.findById(booking.schedule).session(session);
    if (!schedule) throw new Error('Schedule not found');

    // === UPDATE BOOKING ===
    booking.status = 'confirmed';
    booking.passenger = req.user?._id || null;
    await booking.save({ session });

    // === DECREMENT SEATS ===
    schedule.seatsAvailable -= 1;
    await schedule.save({ session });

    // === REAL-TIME UPDATE ===
    io.to(schedule._id.toString()).emit('seat-booked', {
      seatNumber: booking.seatNumber,
      scheduleId: schedule._id,
      pickup: booking.segment.pickup,
      dropoff: booking.segment.dropoff,
      seatsLeft: schedule.seatsAvailable
    });

    // === CHECK IF FULL → AUTO-NEXT VEHICLE ===
    if (schedule.seatsAvailable === 0) {
      const routeKey = `${schedule.saccoName}-${schedule.routeFrom}-${schedule.routeTo}`;
      console.log(`Matatu FULL → freeing vehicle on route: ${routeKey}`);
      await freeVehicleAndAssignNext(routeKey);
    }

    await session.commitTransaction();
    res.json({ message: 'Booking confirmed!', seatsLeft: schedule.seatsAvailable });
  } catch (err) {
    await session.abortTransaction();
    console.error('Booking confirm failed:', err.message);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

// CLEAN UP EXPIRED TEMP RESERVATIONS
setInterval(async () => {
  try {
    const expired = await Booking.deleteMany({
      status: 'temp_reserved',
      reservedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) }
    });
    if (expired.deletedCount > 0) {
      console.log(`Cleaned up ${expired.deletedCount} expired temp reservations`);
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}, 5 * 60 * 1000);

module.exports = router;