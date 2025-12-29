const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Vehicle = require('../models/vehicle');

// Create Vehicle
router.post('/', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const vehicle = new Vehicle({ ...req.body, sacco: req.user.sacco });
    await vehicle.save();
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  const vehicles = await Vehicle.find().populate('driver sacco');
  res.json(vehicles);
});

module.exports = router;