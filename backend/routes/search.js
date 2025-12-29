// backend/routes/search.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Route = require('../models/route');
const Schedule = require('../models/schedule');
const Vehicle = require('../models/vehicle');

router.post('/', auth, async (req, res) => {
  try {
    const { from, to, departureWindow = 120 } = req.body;
    if (!from || !to) return res.status(400).json({ message: 'From and To required' });

    const clean = (str) => str.trim().replace(/\s+/g, ' ').toLowerCase();
    const fromClean = clean(from);
    const toClean = clean(to);

    // 1. Find routes
    const routes = await Route.find({
      $or: [
        { from: { $regex: fromClean, $options: 'i' } },
        { name: { $regex: fromClean, $options: 'i' } }
      ],
      $or: [
        { to: { $regex: toClean, $options: 'i' } },
        { name: { $regex: toClean, $options: 'i' } }
      ]
    }).select('_id name from to').lean();

    if (routes.length === 0) return res.json({ matatus: [] });

    const routeMap = {};
    routes.forEach(r => routeMap[r._id.toString()] = r);

    const routeIds = routes.map(r => r._id);
    const now = new Date();
    const after = new Date(now.getTime() - departureWindow * 60 * 1000);
    const before = new Date(now.getTime() + departureWindow * 60 * 1000);

    // 2. Find schedules
    const schedules = await Schedule.find({
      route: { $in: routeIds },
      departureTime: { $gte: after, $lte: before },
      status: 'scheduled'
    }).select('route vehicle departureTime bookings').lean();

    if (schedules.length === 0) return res.json({ matatus: [] });

    // 3. Get ONLY plate from Vehicle
    const vehicleIds = [...new Set(schedules.map(s => s.vehicle.toString()))];
    const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
      .select('plate')  // ONLY PLATE
      .lean();

    const vehicleMap = {};
    vehicles.forEach(v => vehicleMap[v._id.toString()] = v);

    // 4. Build results
    const matatus = schedules.map(s => {
      const route = routeMap[s.route.toString()] || { name: 'Unknown', from: 'Unknown', to: 'Unknown' };
      const v = vehicleMap[s.vehicle.toString()] || { plate: 'N/A' };
      const seatsLeft = 14 - (s.bookings?.length || 0); // assuming 14 seats
      const waitTime = Math.round((new Date(s.departureTime) - now) / 60000);

      return {
        scheduleId: s._id,
        route: route.name,
        from: route.from,
        to: route.to,
        waitTime,
        vehicle: { plate: v.plate },  // ONLY PLATE
        availableSeats: seatsLeft,
        comfortScore: 50,  // default
        ecoScore: 0
      };
    });

    matatus.sort((a, b) => a.waitTime - b.waitTime);
    res.json({ matatus });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;