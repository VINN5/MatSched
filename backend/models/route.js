// backend/models/route.js
const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  order: { type: Number, required: true },
  fareFromStart: { type: Number, required: true, min: 0 }
});

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  distance: { type: Number, default: 0 },
  estimatedTime: { type: Number, default: 0 },
  price: { type: Number, required: true }, // FULL ROUTE FARE
  stops: [stopSchema],
  sacco: { type: mongoose.Schema.Types.ObjectId, ref: 'Sacco', required: true }
}, { timestamps: true });

// Auto-assign order
routeSchema.pre('save', function(next) {
  if (this.stops && this.stops.length > 0) {
    this.stops.forEach((stop, index) => {
      stop.order = index + 1;
    });
  }
  next();
});

// VALIDATION: Last stop fare must equal full price
routeSchema.pre('save', function(next) {
  if (this.stops && this.stops.length > 0) {
    const lastStopFare = this.stops[this.stops.length - 1].fareFromStart;
    if (lastStopFare !== this.price) {
      return next(new Error('Last stop fare must equal full route price'));
    }
  }
  next();
});

module.exports = mongoose.model('Route', routeSchema);