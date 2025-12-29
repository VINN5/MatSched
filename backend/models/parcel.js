// backend/models/parcel.js
const mongoose = require('mongoose');

const parcelSchema = new mongoose.Schema({
  description: { type: String, required: true },
  pickup: { type: String, required: true },
  dropoff: { type: String, required: true },
  fee: { type: Number, required: true, min: 50 }, // KES
  senderPhone: String,
  receiverPhone: String,
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule' },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'delivered'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Parcel', parcelSchema);