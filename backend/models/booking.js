// backend/models/booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
  seatNumber: { type: Number, required: true },
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco', required: true }, // ← ADDED
  status: {
    type: String,
    enum: ['temp_reserved', 'pending_payment', 'confirmed', 'cancelled'],
    default: 'temp_reserved'
  },
  totalAmount: { type: Number },
  saccoAmount: { type: Number },
  developerFee: { type: Number, default: 2 },
  reservedAt: { type: Date },
  segment: {
    pickup: { type: String, required: true },
    dropoff: { type: String, required: true },
    fare: { type: Number, required: true }
  }
}, { timestamps: true });

// Index for cleanup
bookingSchema.index({ status: 1, reservedAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);