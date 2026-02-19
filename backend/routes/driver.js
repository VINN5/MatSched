// backend/routes/driver.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Schedule = require('../models/schedule');
const Booking = require('../models/booking');
const Parcel = require('../models/parcel');
const Vehicle = require('../models/vehicle');
const mongoose = require('mongoose');

// === GET CURRENT SCHEDULE WITH PASSENGERS ===
router.get('/schedule', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const schedule = await Schedule.findOne({
      vehicle: req.user.vehicle,
      departureTime: { $gte: today, $lt: tomorrow },
      isActive: true
    })
      .populate('route', 'name from to stops price')
      .populate('vehicle', 'plate type capacity');

    if (!schedule) return res.json(null);

    // Get all confirmed bookings with passenger details
    const bookings = await Booking.find({
      schedule: schedule._id,
      status: 'confirmed'
    })
      .populate('passenger', 'name phone')
      .select('passenger segment.pickup segment.dropoff segment.fare boardingStatus');

    const passengers = bookings.map(b => ({
      id: b._id,
      name: b.passenger?.name || 'Unknown',
      phone: b.passenger?.phone || 'N/A',
      pickup: b.segment?.pickup || schedule.route?.from,
      dropoff: b.segment?.dropoff || schedule.route?.to,
      fare: b.segment?.fare || 0,
      boarded: b.boardingStatus === 'boarded'
    }));

    res.json({
      _id: schedule._id,
      route: schedule.route,
      vehicle: schedule.vehicle,
      departureTime: schedule.departureTime,
      expectedReturnTime: schedule.expectedReturnTime,
      status: schedule.status,
      bookedSeats: bookings.length,
      totalCapacity: schedule.vehicle?.capacity || 14,
      passengers
    });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ message: err.message });
  }
});

// === START TRIP ===
router.post('/trip/start', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      vehicle: req.user.vehicle,
      status: 'scheduled',
      isActive: true
    });

    if (!schedule) {
      return res.status(404).json({ message: 'No scheduled trip found' });
    }

    schedule.status = 'in_transit';
    await schedule.save();

    res.json({ message: 'Trip started!', schedule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === COMPLETE TRIP ===
router.post('/trip/complete', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const schedule = await Schedule.findOne({
      vehicle: req.user.vehicle,
      status: 'in_transit',
      isActive: true
    }).populate('vehicle');

    if (!schedule) {
      return res.status(404).json({ message: 'No active trip found' });
    }

    // Mark schedule as completed
    schedule.status = 'completed';
    await schedule.save();

    // Free up vehicle
    if (schedule.vehicle) {
      await Vehicle.findByIdAndUpdate(schedule.vehicle._id, {
        status: 'available'
      });
    }

    // Calculate trip earnings
    const bookings = await Booking.find({
      schedule: schedule._id,
      status: 'confirmed'
    });

    const totalEarnings = bookings.reduce((sum, b) => sum + (b.segment?.fare || 0), 0);

    res.json({
      message: 'Trip completed!',
      earnings: totalEarnings,
      passengers: bookings.length
    });
  } catch (err) {
    console.error('Complete trip error:', err);
    res.status(500).json({ message: err.message });
  }
});

// === MARK PASSENGER BOARDED ===
router.post('/passenger/board/:bookingId', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { boardingStatus: 'boarded' },
      { new: true }
    ).populate('passenger', 'name');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({
      message: `${booking.passenger?.name || 'Passenger'} marked as boarded`,
      booking
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === GET ASSIGNED PARCELS ===
router.get('/parcels', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const parcels = await Parcel.find({
      driver: req.user._id,
      status: { $in: ['assigned', 'picked_up'] }
    });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === MARK PARCEL DELIVERED ===
router.post('/parcel/delivered/:id', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const parcel = await Parcel.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { status: 'delivered', deliveredAt: new Date() },
      { new: true }
    );
    if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
    res.json({ message: 'Delivered!', fee: parcel.fee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === VERIFY PASSENGER QR ===
router.post('/verify', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    const booking = await Booking.findOne({
      _id: bookingId,
      status: 'confirmed'
    })
      .populate('passenger', 'name phone')
      .populate('schedule', 'vehicle');

    if (!booking) {
      return res.status(400).json({ message: 'Invalid booking code' });
    }

    // Verify this booking is for driver's current vehicle
    if (booking.schedule?.vehicle?.toString() !== req.user.vehicle?.toString()) {
      return res.status(400).json({ message: 'This passenger is not on your vehicle' });
    }

    // Mark as boarded
    booking.boardingStatus = 'boarded';
    await booking.save();

    res.json({
      message: 'Passenger verified and boarded!',
      passenger: {
        name: booking.passenger?.name,
        phone: booking.passenger?.phone,
        pickup: booking.segment?.pickup,
        dropoff: booking.segment?.dropoff,
        fare: booking.segment?.fare
      }
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: err.message });
  }
});

// === SOS ===
router.post('/sos', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const { location, issue } = req.body;
    
    console.log(`🚨 SOS ALERT from ${req.user.name} (${req.user._id})`);
    console.log(`Location: ${location || 'Unknown'}`);
    console.log(`Issue: ${issue || 'Emergency'}`);

    // TODO: Send SMS to Sacco admin, trigger alert in admin dashboard
    // TODO: Log to database for tracking

    res.json({ message: 'SOS sent to Sacco control' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === EARNINGS (TODAY + BREAKDOWN) ===
router.get('/earnings', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Trip earnings (confirmed bookings)
    const completedSchedules = await Schedule.find({
      vehicle: req.user.vehicle,
      status: 'completed',
      departureTime: { $gte: today, $lt: tomorrow }
    });

    const scheduleIds = completedSchedules.map(s => s._id);

    const bookings = await Booking.find({
      schedule: { $in: scheduleIds },
      status: 'confirmed'
    });

    const tripEarnings = bookings.reduce((sum, b) => sum + (b.segment?.fare || 0), 0);
    const tripCount = completedSchedules.length;

    // Parcel earnings
    const parcels = await Parcel.find({
      driver: req.user._id,
      status: 'delivered',
      deliveredAt: { $gte: today, $lt: tomorrow }
    });

    const parcelEarnings = parcels.reduce((sum, p) => sum + (p.fee || 0), 0);

    const total = tripEarnings + parcelEarnings;

    res.json({
      today: total,
      tripEarnings,
      parcelEarnings,
      tripCount,
      parcelCount: parcels.length,
      passengers: bookings.length
    });
  } catch (err) {
    console.error('Earnings error:', err);
    res.status(500).json({ message: err.message });
  }
});

// === TRIP HISTORY ===
router.get('/history', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const schedules = await Schedule.find({
      vehicle: req.user.vehicle,
      status: 'completed'
    })
      .populate('route', 'name from to')
      .sort({ departureTime: -1 })
      .skip(skip)
      .limit(limit);

    const history = await Promise.all(
      schedules.map(async (s) => {
        const bookings = await Booking.countDocuments({
          schedule: s._id,
          status: 'confirmed'
        });

        const earnings = await Booking.find({
          schedule: s._id,
          status: 'confirmed'
        });

        const total = earnings.reduce((sum, b) => sum + (b.segment?.fare || 0), 0);

        return {
          id: s._id,
          route: s.route?.name || `${s.routeFrom} to ${s.routeTo}`,
          date: s.departureTime,
          passengers: bookings,
          earnings: total
        };
      })
    );

    res.json({ history, page });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === VEHICLE STATUS ===
router.get('/vehicle', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.user.vehicle).select('plate type capacity status');
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not assigned' });
    }

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;