const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Sacco = require('../models/sacco');

// Create Sacco (Admin only)
router.post('/', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const sacco = new Sacco({ ...req.body, admin: req.user._id });
    await sacco.save();
    res.status(201).json(sacco);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all saccos
router.get('/', auth, async (req, res) => {
  const saccos = await Sacco.find().populate('admin', 'name email');
  res.json(saccos);
});

module.exports = router;