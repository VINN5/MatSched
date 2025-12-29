const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/role');
const Route = require('../models/route');

// Create Route (Sacco Admin only)
router.post('/', auth, roleCheck(['sacco_admin']), async (req, res) => {
  try {
    const route = new Route({ ...req.body, sacco: req.user.sacco });
    await route.save();
    res.status(201).json(route);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all routes
router.get('/', auth, async (req, res) => {
  const routes = await Route.find().populate('sacco', 'name');
  res.json(routes);
});

module.exports = router;