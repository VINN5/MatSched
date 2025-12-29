// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail'); // ← CREATE THIS FILE

// === REGISTER === (unchanged)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = new User({
      name,
      email,
      password,
      phone,
      role: role || 'passenger'
    });

    await user.save();
    await user.populate('sacco');

    const saccoId = user.sacco ? user.sacco._id.toString() : null;

    const token = jwt.sign(
      {
        _id: user._id.toString(),
        role: user.role,
        sacco: saccoId
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        sacco: saccoId,
        saccoName: user.sacco ? user.sacco.name : null
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `${field} already exists` });
    }
    res.status(400).json({ message: error.message });
  }
});

// === LOGIN === (unchanged)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email })
      .select('+password +sacco')
      .populate('sacco');

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const saccoId = user.sacco ? user.sacco._id.toString() : null;

    const token = jwt.sign(
      {
        _id: user._id.toString(),
        role: user.role,
        sacco: saccoId
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // === DRIVER QUEUE LOGIC ===
    if (user.role === 'driver' && user.sacco) {
      const io = req.app.get('io');
      const routeQueue = req.app.get('routeQueue');
      const activeRoutes = req.app.get('activeRoutes');
      const assignNextVehicle = req.app.get('assignNextVehicle');

      const routeKey = `${user.sacco.name}-${user.sacco.routeFrom}-${user.sacco.routeTo}`;

      if (!routeQueue[routeKey]) {
        routeQueue[routeKey] = [];
      }

      const driverEntry = {
        driverId: user._id.toString(),
        saccoId: saccoId,
        route: {
          from: user.sacco.routeFrom,
          to: user.sacco.routeTo
        },
        status: 'waiting'
      };
      routeQueue[routeKey].push(driverEntry);

      if (!activeRoutes.has(routeKey)) {
        activeRoutes.add(routeKey);
        driverEntry.status = 'assigned';
        await assignNextVehicle(routeKey);

        if (io) {
          io.to(`driver-${user._id}`).emit('driver-assigned', {
            message: 'You are assigned to the next trip!',
            route: driverEntry.route
          });
        }
      } else {
        const position = routeQueue[routeKey].findIndex(d => d.driverId === user._id.toString()) + 1;
        if (io) {
          io.to(`driver-${user._id}`).emit('queue-update', position);
        }
      }
    }

    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        sacco: saccoId,
        saccoName: user.sacco ? user.sacco.name : null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

// === GET CURRENT USER === (unchanged)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('sacco');

    const saccoId = user.sacco ? user.sacco._id.toString() : null;

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        sacco: saccoId,
        saccoName: user.sacco ? user.sacco.name : null
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === FORGOT PASSWORD ===
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: 'If email exists, reset link sent' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #4f46e5;">MatSched Password Reset</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
      </div>
    `;

    await sendEmail(user.email, 'Password Reset - MatSched', html);
    res.json({ message: 'If email exists, reset link sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// === VERIFY RESET_TOKEN ===
router.get('/reset-password/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    res.json({ message: 'Token valid' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// === RESET PASSWORD ===
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be 6+ chars' });
    }

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password; // ← Triggers pre-save hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;