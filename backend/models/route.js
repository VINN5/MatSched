// backend/models/route.js
const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  distance: { type: Number, default: 0 },
  estimatedTime: { type: Number, default: 0 },
  price: { type: Number, required: true },
  stops: [
    {
      name: { type: String, required: true },
      fareFromStart: { type: Number, required: true },
      order: { type: Number, required: true },
      latitude: { type: Number },  // GPS coordinate
      longitude: { type: Number }  // GPS coordinate
    }
  ],
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

routeSchema.index({ sacco: 1, from: 1, to: 1 });
routeSchema.index({ sacco: 1, isActive: 1 });

module.exports = mongoose.model('Route', routeSchema);