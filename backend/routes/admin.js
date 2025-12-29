// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Route = require('../models/route');
const Vehicle = require('../models/vehicle');
const Schedule = require('../models/schedule');
const User = require('../models/user');
const mongoose = require('mongoose');

const ObjectId = mongoose.Types.ObjectId;

// === GET ADMIN'S SACCO INFO ===
router.get('/me', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('sacco')
      .populate('sacco', 'name');

    if (!user?.sacco) {
      return res.status(400).json({ message: 'Admin not linked to a Sacco' });
    }

    res.json({
      saccoId: user.sacco._id.toString(),
      saccoName: user.sacco.name
    });
  } catch (err) {
    console.error('Admin /me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === ADD ROUTE WITH STOPS + FULL PRICE ===
router.post('/routes', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const { name, from, to, distance, estimatedTime, price, stops } = req.body;
    const saccoId = req.user.sacco;

    if (!saccoId) return res.status(400).json({ message: 'Sacco not found for admin' });
    if (!name || !from || !to || !price || price <= 0) {
      return res.status(400).json({ message: 'Name, from, to, and full price are required' });
    }
    if (!stops || stops.length < 2) {
      return res.status(400).json({ message: 'At least 2 stops required' });
    }
    if (stops[stops.length - 1].fareFromStart !== price) {
      return res.status(400).json({ message: 'Last stop fare must equal full route price' });
    }

    const route = new Route({
      name,
      from,
      to,
      distance: distance || 0,
      estimatedTime: estimatedTime || 0,
      price: parseInt(price),
      stops: stops.map((s, i) => ({
        name: s.name,
        fareFromStart: parseInt(s.fareFromStart) || 0,
        order: i + 1
      })),
      sacco: new ObjectId(saccoId)
    });

    await route.save();
    res.status(201).json({ message: 'Route added', route });
  } catch (err) {
    console.error('Add route error:', err);
    res.status(400).json({ message: err.message });
  }
});

// === UPDATE ROUTE (EDIT) ===
router.put('/routes/:id', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const { name, from, to, distance, estimatedTime, price, stops } = req.body;
    const saccoId = req.user.sacco;

    if (!name || !from || !to || !price || !stops || stops.length < 2) {
      return res.status(400).json({ message: 'Invalid route data: name, from, to, price, and at least 2 stops required' });
    }
    if (stops[stops.length - 1].fareFromStart !== price) {
      return res.status(400).json({ message: 'Last stop fare must equal full route price' });
    }

    const route = await Route.findOneAndUpdate(
      { _id: req.params.id, sacco: new ObjectId(saccoId) },
      {
        name,
        from,
        to,
        distance: parseInt(distance) || 0,
        estimatedTime: parseInt(estimatedTime) || 0,
        price: parseInt(price),
        stops: stops.map((s, i) => ({
          name: s.name,
          fareFromStart: parseInt(s.fareFromStart) || 0,
          order: i + 1
        }))
      },
      { new: true, runValidators: true }
    );

    if (!route) {
      return res.status(404).json({ message: 'Route not found or not in your sacco' });
    }

    res.json({ message: 'Route updated successfully', route });
  } catch (err) {
    console.error('Update route error:', err);
    res.status(400).json({ message: err.message });
  }
});

// === DELETE ROUTE ===
router.delete('/routes/:id', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    const route = await Route.findOneAndDelete({
      _id: req.params.id,
      sacco: new ObjectId(saccoId)
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found or not in your sacco' });
    }

    // Optional: Delete associated schedules
    await Schedule.deleteMany({ route: req.params.id });

    res.json({ message: 'Route and all associated schedules deleted' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === ADD VEHICLE ===
router.post('/vehicles', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const { plate, type, capacity } = req.body;
    const saccoId = req.user.sacco;

    if (!saccoId) return res.status(400).json({ message: 'Sacco not found for admin' });

    const vehicleType = type || 'matatu';
    const vehicleCapacity = capacity || (vehicleType === 'matatu' ? 14 : 33);

    const vehicle = new Vehicle({
      plate: plate.toUpperCase().trim(),
      type: vehicleType,
      capacity: vehicleCapacity,
      sacco: new ObjectId(saccoId),
      status: 'available'
    });

    await vehicle.save();
    res.status(201).json({ message: 'Vehicle added', vehicle });
  } catch (err) {
    console.error('Add vehicle error:', err);
    res.status(400).json({ message: err.message });
  }
});

// === UPDATE VEHICLE ===
router.put('/vehicles/:id', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const { plate, type, capacity } = req.body;
    const saccoId = req.user.sacco;

    if (!plate || !type || !capacity) {
      return res.status(400).json({ message: 'Plate, type, and capacity are required' });
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, sacco: new ObjectId(saccoId) },
      {
        $set: {
          plate: plate.toUpperCase().trim(),
          type,
          capacity: parseInt(capacity)
        }
      },
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found or not in your sacco' });
    }

    res.json({ message: 'Vehicle updated', vehicle });
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(400).json({ message: err.message });
  }
});

// === CREATE SCHEDULE (WITH RETURN LOGIC) ===
router.post('/schedules', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const { route: routeId, vehicle: vehicleId, departureTime, isRoundTrip = true } = req.body;
    const saccoId = req.user.sacco;

    if (!saccoId || !routeId || !vehicleId || !departureTime) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const [routeDoc, vehicleDoc] = await Promise.all([
      Route.findOne({ _id: routeId, sacco: new ObjectId(saccoId) }),
      Vehicle.findOne({ _id: vehicleId, sacco: new ObjectId(saccoId), status: 'available' })
    ]);

    if (!routeDoc || !vehicleDoc) {
      return res.status(400).json({ message: 'Route or vehicle not found/available' });
    }

    const sacco = await require('../models/sacco').findById(saccoId).select('name');
    const departure = new Date(departureTime);

    // === TRAFFIC MULTIPLIER ===
    const hour = departure.getHours();
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
    const trafficMultiplier = isRushHour ? 1.8 : (hour >= 9 && hour <= 11 || hour >= 14 && hour <= 16) ? 1.3 : 1.0;

    // === ROUND TRIP + REST ===
    const oneWayMins = routeDoc.estimatedTime || 45;
    const roundTripMins = isRoundTrip ? oneWayMins * 2 : oneWayMins;
    const totalMins = roundTripMins * trafficMultiplier + 15; // +15 min rest
    const expectedReturn = new Date(departure.getTime() + totalMins * 60 * 1000);

    const schedule = new Schedule({
      route: routeId,
      routeFrom: routeDoc.from,
      routeTo: routeDoc.to,
      vehicle: vehicleId,
      departureTime: departure,
      sacco: new ObjectId(saccoId),
      saccoName: sacco.name,
      seatsAvailable: vehicleDoc.capacity,
      isActive: true,
      expectedReturnTime: expectedReturn,
      isRoundTrip
    });

    vehicleDoc.status = 'scheduled';
    await Promise.all([schedule.save(), vehicleDoc.save()]);

    res.status(201).json({ message: 'Schedule created!', schedule });
  } catch (err) {
    console.error('Schedule error:', err);
    res.status(400).json({ message: err.message });
  }
});

// === GET ROUTES ===
router.get('/routes', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    if (!saccoId) return res.status(400).json({ message: 'Sacco not found' });

    const routes = await Route.find({ sacco: new ObjectId(saccoId) }).sort({ name: 1 });
    res.json(routes);
  } catch (err) {
    console.error('Get routes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === GET VEHICLES (AVAILABLE ONLY) ===
router.get('/vehicles', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    if (!saccoId) return res.status(400).json({ message: 'No sacco linked' });

    const vehicles = await Vehicle.find({
      sacco: new ObjectId(saccoId),
      status: 'available'
    }).sort({ plate: 1 });

    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// === GET TODAY'S SCHEDULES ===
router.get('/schedules', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    if (!saccoId) return res.status(400).json({ message: 'Sacco not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const schedules = await Schedule.find({
      sacco: new ObjectId(saccoId),
      departureTime: { $gte: today, $lt: tomorrow },
      isActive: true
    })
      .populate('route', 'name from to price stops')
      .populate('vehicle', 'plate type')
      .sort({ departureTime: 1 });

    res.json(schedules);
  } catch (err) {
    console.error('Get today schedules error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === GET PAST SCHEDULES (PAGINATED) ===
router.get('/schedules/past', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    if (!saccoId) return res.status(400).json({ message: 'Sacco not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
      Schedule.find({
        sacco: new ObjectId(saccoId),
        departureTime: { $lt: today },
        isActive: true
      })
        .populate('route', 'name from to')
        .populate('vehicle', 'plate type')
        .sort({ departureTime: -1 })
        .skip(skip)
        .limit(limit),

      Schedule.countDocuments({
        sacco: new ObjectId(saccoId),
        departureTime: { $lt: today },
        isActive: true
      })
    ]);

    res.json({
      schedules,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    console.error('Get past schedules error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === GET TODAY'S REVENUE BY SEGMENT ===
router.get('/revenue/today', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const saccoId = req.user.sacco;
    if (!saccoId) return res.status(400).json({ message: 'Sacco not found' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const Booking = require('../models/booking');

    const bookings = await Booking.find({
      sacco: new ObjectId(saccoId),
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: 'confirmed',
      'segment.pickup': { $exists: true },
      'segment.dropoff': { $exists: true }
    })
      .populate('schedule', 'vehicle')
      .select('segment.fare schedule');

    const revenueMap = {};

    bookings.forEach(b => {
      const plate = b.schedule?.vehicle?.plate || 'UNKNOWN';
      const pickup = b.segment.pickup;
      const dropoff = b.segment.dropoff;
      const fare = b.segment.fare;
      const key = `${plate}-${pickup}-${dropoff}`;

      if (!revenueMap[key]) {
        revenueMap[key] = {
          plate,
          pickup,
          dropoff,
          bookings: 0,
          totalFare: 0,
          devFee: 0,
          totalRevenue: 0
        };
      }

      revenueMap[key].bookings += 1;
      revenueMap[key].totalFare += fare;
      revenueMap[key].devFee += 2;
      revenueMap[key].totalRevenue += fare + 2;
    });

    const revenue = Object.values(revenueMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({ revenue });
  } catch (err) {
    console.error('Revenue today error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;