// backend/routes/driver.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Schedule = require('../models/schedule');
const Booking = require('../models/booking');
const Parcel = require('../models/parcel');
const Vehicle = require('../models/vehicle');

// GET CURRENT SCHEDULE
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
    }).populate('route vehicle');

    if (!schedule) return res.json(null);

    const booked = await Booking.countDocuments({
      schedule: schedule._id,
      status: 'confirmed'
    });

    res.json({
      ...schedule.toObject(),
      bookedSeats: booked
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET ASSIGNED PARCELS
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

// MARK PARCEL DELIVERED
router.post('/parcel/delivered/:id', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const parcel = await Parcel.findOneAndUpdate(
      { _id: req.params.id, driver: req.user._id },
      { status: 'delivered' },
      { new: true }
    );
    if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
    res.json({ message: 'Delivered!', fee: parcel.fee });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// VERIFY PASSENGER QR
router.post('/verify', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findOne({
      _id: bookingId,
      status: 'confirmed',
      schedule: { $in: await Schedule.find({ vehicle: req.user.vehicle }).distinct('_id') }
    });
    if (!booking) return res.status(400).json({ message: 'Invalid booking' });
    res.json({ message: 'Verified', passenger: booking.passenger });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// SOS
router.post('/sos', auth, roleCheck(['driver']), async (req, res) => {
  console.log(`SOS from driver ${req.user.name} (ID: ${req.user._id})`);
  // TODO: Send SMS to Sacco
  res.json({ message: 'SOS sent to Sacco' });
});

// EARNINGS
router.get('/earnings', auth, roleCheck(['driver']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parcels = await Parcel.find({
      driver: req.user._id,
      status: 'delivered',
      createdAt: { $gte: today }
    });

    const total = parcels.reduce((sum, p) => sum + p.fee, 0);
    res.json({ today: total, count: parcels.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;