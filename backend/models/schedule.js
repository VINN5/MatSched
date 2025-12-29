// backend/models/schedule.js
const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  route: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Route', 
    required: true 
  },
  routeFrom: { type: String, required: true },
  routeTo: { type: String, required: true },
  vehicle: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vehicle', 
    required: true 
  },
  departureTime: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'in_transit', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco', required: true },
  saccoName: { type: String, required: true },
  bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
  seatsAvailable: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  
  // === NEW: RETURN LOGIC ===
  expectedReturnTime: { type: Date }, // Auto-calculated
  isRoundTrip: { type: Boolean, default: true }, // Default: to-and-fro

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
scheduleSchema.index({ sacco: 1, routeFrom: 1, routeTo: 1, isActive: 1 });
scheduleSchema.index({ departureTime: 1, isActive: 1 });
scheduleSchema.index({ vehicle: 1, status: 1 });
scheduleSchema.index({ expectedReturnTime: 1 }); // For cron job

scheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Schedule', scheduleSchema);