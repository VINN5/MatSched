// backend/models/vehicle.js
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  plate: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ['matatu', 'bus'], default: 'matatu' },
  capacity: {
    type: Number,
    required: function() { return this.isNew; }, // ← ONLY ON CREATE
    min: 14,
    max: 60,
    default: 14
  },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco', required: true },
  
  status: { 
    type: String, 
    enum: ['available', 'scheduled', 'in_transit', 'maintenance'], 
    default: 'available' 
  },

  comfort: {
    hasAC: { type: Boolean, default: false },
    hasWiFi: { type: Boolean, default: false },
    seatType: { type: String, enum: ['standard', 'reclining'], default: 'standard' },
    cleanlinessRating: { type: Number, min: 1, max: 5, default: 3 }
  },

  ecoScore: { type: Number, min: 0, max: 100, default: 50 },
  driverRating: { type: Number, min: 1, max: 5, default: 3 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

vehicleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);