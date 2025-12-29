const mongoose = require('mongoose');

const saccoSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "Nairobi Matatu Sacco"
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    routes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Route' }],
    vehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Sacco', saccoSchema);