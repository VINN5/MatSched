// backend/routes/schedules.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Schedule = require('../models/schedule');
const Route = require('../models/route');
const Vehicle = require('../models/vehicle');
const Booking = require('../models/booking');

// === HELPER: IS RUSH HOUR? (Mon–Fri, 7–9 AM, 5–8 PM) ===
const isRushHour = (date) => {
  if (!date) return false;
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sun, 1 = Mon
  return (day >= 1 && day <= 5) && // Monday to Friday
    (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20); // 7–9 AM, 5–8 PM
};

// === SMART SEARCH (FULLY FIXED & CORRECT) ===
router.post('/smart', auth, async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ message: 'From and to are required' });
    }

    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours

    // === FIND ROUTES (case-insensitive partial match) ===
    const routes = await Route.find({
      $and: [
        { from: { $regex: from.trim(), $options: 'i' } },
        { to: { $regex: to.trim(), $options: 'i' } }
      ]
    });

    if (routes.length === 0) {
      return res.json({ matatus: [] });
    }

    // === FIND SCHEDULES (only needed fields) ===
    const schedules = await Schedule.find({
      route: { $in: routes.map(r => r._id) },
      departureTime: { $gte: now, $lte: twoHoursLater },
      status: 'scheduled',
      isActive: true
    })
      .select('departureTime vehicle route sacco saccoName seatsAvailable')
      .populate('route', 'name from to price stops')  // ← INCLUDES stops
      .populate({
        path: 'vehicle',
        select: 'plate type capacity comfort ecoScore'
      })
      .populate({
        path: 'bookings',
        match: { status: 'confirmed' },
        select: '_id'
      })
      .lean();

    if (schedules.length === 0) {
      return res.json({ matatus: [] });
    }

    // === BUILD MATATU LIST ===
    const matatus = schedules
      .map(s => {
        const departure = s.departureTime ? new Date(s.departureTime) : null;
        const waitTime = departure ? Math.max(1, Math.round((departure - now) / 60000)) : 999;

        // === RUSH HOUR & PRICE LOGIC ===
        const basePrice = s.route?.price || 100;
        const surge = isRushHour(departure);
        const finalPrice = surge ? Math.round(basePrice * 1.5) : basePrice;

        // Use vehicle.capacity from DB
        const totalSeats = s.vehicle?.capacity || 14;
        const booked = Array.isArray(s.bookings) ? s.bookings.length : 0;
        const available = s.seatsAvailable || (totalSeats - booked);

        // Comfort score
        const comfort = s.vehicle?.comfort || {};
        const comfortScore =
          (comfort.hasAC ? 25 : 0) +
          (comfort.hasWiFi ? 15 : 0) +
          ((comfort.cleanlinessRating || 3) * 3) +
          (available > 3 ? 20 : 0);

        // Skip if no seats or too far
        if (available <= 0 || waitTime > 120 || waitTime < 0) return null;

        return {
          scheduleId: s._id.toString(),
          route: s.route,  // ← FULL OBJECT: name, from, to, price, stops
          from: s.route?.from,
          to: s.route?.to,
          waitTime,
          availableSeats: available,
          comfortScore: Math.min(comfortScore, 100),
          ecoScore: s.vehicle?.ecoScore || 50,
          departureTime: departure ? departure.toISOString() : null,
          price: finalPrice,
          isSurge: surge,
          basePrice: basePrice,
          vehicle: {
            plate: s.vehicle?.plate || 'KCA 000X',
            type: s.vehicle?.type || 'matatu',
            capacity: totalSeats
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.comfortScore - a.comfortScore)
      .slice(0, 5);

    // DEBUG LOG
    console.log('MATATU STOPS COUNT:', matatus[0]?.route?.stops?.length || 0);

    res.json({ matatus });
  } catch (err) {
    console.error('Smart search error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;