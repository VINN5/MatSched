const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { 
    type: String, 
    required: true,
    match: [/^254[1-9]\d{8}$/, 'Please enter a valid Kenyan phone number (254xxxxxxxxx)']
  }, // ← ADDED HERE
  role: {
    type: String,
    enum: ['passenger', 'driver', 'sacco_admin'],
    default: 'passenger'
  },
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco' },

  // Preferences
  preferences: {
    maxWait: { type: Number, default: 10 },
    seatPreference: { type: String, enum: ['window', 'aisle', 'any'], default: 'any' },
    seatRow: { type: String, enum: ['front', 'middle', 'back', 'any'], default: 'any' },
    ecoFriendly: { type: Boolean, default: false },
    minComfort: { type: Number, default: 70 }
  },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);