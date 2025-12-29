// backend/models/RouteQueue.js
const mongoose = require('mongoose');

const RouteQueueSchema = new mongoose.Schema({
  routeKey: { type: String, unique: true },
  queue: [{
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    status: { type: String, enum: ['waiting', 'assigned'], default: 'waiting' }
  }],
  activeVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null }
});

module.exports = mongoose.model('RouteQueue', RouteQueueSchema);