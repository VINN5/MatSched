// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const saccoRoutes = require('./routes/saccos');
const logger = require('./middleware/logger');
const cors = require('cors');
const searchRoutes = require('./routes/search');
const mpesaRoutes = require('./routes/mpesa'); // ← MPESA DARAJA
const cron = require('node-cron');
const Schedule = require('./models/schedule');
const Vehicle = require('./models/vehicle');

// === QUEUE SYSTEM (IN-MEMORY) ===
const routeQueue = {};
const activeRoutes = new Set();
const assignedVehicles = new Set();

const app = express();
const port = process.env.PORT || 10000; // Render assigns a port via process.env.PORT

// === HTTP SERVER ===
const server = http.createServer(app);

// === CORS — Allow localhost (dev) + live frontend (production) ===
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://matsched.onrender.com'  // Your live frontend URL
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// === SOCKET.IO ===
const io = new Server(server, {
  cors: corsOptions
});

app.set('io', io);
module.exports.io = io;

// === MIDDLEWARE ===
app.use(express.json());
app.use(logger);

// === DATABASE ===
connectDB();

// === ROUTES ===
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/mpesa', mpesaRoutes);         // ← MPESA DARAJA
app.use('/api/admin', adminRoutes);
app.use('/api/admin/saccos', saccoRoutes);
app.use('/api/driver', require('./routes/driver'));

// === ROOT ===
app.get('/', (req, res) => {
  res.send('MatSched Backend API + Socket.IO + MPesa Daraja (SANDBOX) is running!');
});

// === TEST MPESA DARAJA CONNECTION (SANDBOX) ===
app.get('/test-mpesa', async (req, res) => {
  try {
    const axios = require('axios');
    const tokenUrl = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');

    const tokenRes = await axios.get(tokenUrl, {
      headers: { Authorization: `Basic ${auth}` }
    });

    res.json({
      message: "MPesa Daraja SANDBOX connection successful!",
      access_token: tokenRes.data.access_token,
      expires_in: tokenRes.data.expires_in,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("MPesa test failed:", err.response?.data || err.message);
    res.status(400).json({
      error: "MPesa connection failed",
      details: err.response?.data || err.message
    });
  }
});

// === QUEUE MANAGER HELPERS ===
const assignNextVehicle = async (routeKey) => {
  if (!routeQueue[routeKey] || routeQueue[routeKey].length === 0) {
    console.log(`No drivers in queue for ${routeKey}`);
    return;
  }

  const next = routeQueue[routeKey][0];

  const availableVehicle = await Vehicle.findOne({
    sacco: next.saccoId,
    status: 'available'
  });

  if (!availableVehicle) {
    console.log(`No vehicle available for ${routeKey}`);
    return;
  }

  availableVehicle.status = 'scheduled';
  await availableVehicle.save();
  assignedVehicles.add(availableVehicle._id.toString());

  next.vehicle = {
    _id: availableVehicle._id,
    plate: availableVehicle.plate,
    capacity: availableVehicle.capacity || 14
  };

  const roundTripTime = 60 * 60 * 1000;
  const departureTime = new Date(Date.now() + 5 * 60 * 1000);
  const expectedReturnTime = new Date(departureTime.getTime() + roundTripTime);

  const schedule = await Schedule.create({
    route: next.routeId || null,
    routeFrom: next.route.from,
    routeTo: next.route.to,
    vehicle: availableVehicle._id,
    departureTime,
    expectedReturnTime,
    sacco: next.saccoId,
    saccoName: next.saccoName,
    seatsAvailable: availableVehicle.capacity,
    isActive: true
  });

  io.to(`driver-${next.driverId}`).emit('driver-assigned', {
    scheduleId: schedule._id,
    route: { from: next.route.from, to: next.route.to },
    vehicle: next.vehicle,
    departureTime: schedule.departureTime,
    seatsAvailable: schedule.seatsAvailable
  });

  console.log(`Assigned ${availableVehicle.plate} to driver ${next.driverId} on ${routeKey}`);
};

const freeVehicleAndAssignNext = async (routeKey) => {
  const current = routeQueue[routeKey].shift();

  if (current?.vehicle?._id) {
    assignedVehicles.delete(current.vehicle._id);
    await Vehicle.findByIdAndUpdate(current.vehicle._id, { status: 'available' });
  }

  activeRoutes.delete(routeKey);

  if (routeQueue[routeKey].length > 0) {
    activeRoutes.add(routeKey);
    await assignNextVehicle(routeKey);
  }

  routeQueue[routeKey].forEach((entry, index) => {
    io.to(`driver-${entry.driverId}`).emit('queue-update', index + 1);
  });
};

// === EXPOSE TO ALL ROUTES ===
app.set('routeQueue', routeQueue);
app.set('activeRoutes', activeRoutes);
app.set('assignedVehicles', assignedVehicles);
app.set('assignNextVehicle', assignNextVehicle);
app.set('freeVehicleAndAssignNext', freeVehicleAndAssignNext);

// === SOCKET.IO CONNECTIONS ===
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-driver', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined room`);
  });

  socket.on('join-schedule', (scheduleId) => {
    socket.join(scheduleId);
    console.log(`User ${socket.id} joined schedule: ${scheduleId}`);
  });

  socket.on('join-sacco', (saccoId) => {
    socket.join(`sacco-${saccoId}`);
    console.log(`Admin joined sacco room: ${saccoId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// === VEHICLE RETURN CRON JOB (Every Minute) ===
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const overdueSchedules = await Schedule.find({
      expectedReturnTime: { $lt: now },
      status: { $in: ['scheduled', 'in_transit'] },
      isActive: true
    }).populate('vehicle sacco');

    for (const sched of overdueSchedules) {
      const vehicle = sched.vehicle;
      const saccoId = sched.sacco?._id;

      if (vehicle && ['scheduled', 'in_transit'].includes(vehicle.status)) {
        await Vehicle.updateOne(
          { _id: vehicle._id },
          { $set: { status: 'available' } }
        );

        sched.status = 'completed';
        await sched.save();

        if (saccoId) {
          io.to(`sacco-${saccoId}`).emit('vehicle-returned', {
            vehicleId: vehicle._id,
            plate: vehicle.plate,
            message: `${vehicle.plate} has returned and is now available`
          });
        }

        console.log(`[CRON] Vehicle ${vehicle.plate} returned at ${now.toLocaleString()}`);
      }
    }
  } catch (err) {
    console.error('[CRON ERROR] Vehicle return job failed:', err);
  }
});

console.log('CRON JOB ACTIVE: Vehicles return automatically after round trip');

// === START SERVER ===
server.listen(port, '0.0.0.0', () => {
  console.log(`Server + Socket.IO + MPesa Daraja (SANDBOX) running on port ${port}`);
  console.log(`API URL: https://matsched-backend.onrender.com`);
  console.log(`TEST MPESA: https://matsched-backend.onrender.com/test-mpesa`);
  console.log(`MPESA CALLBACK URL: ${process.env.MPESA_CALLBACK_URL || 'Not set'}`);
  console.log(`SOCKET.IO READY — Real-time seat updates active`);
  console.log(`DRIVER QUEUE SYSTEM ACTIVE — Dynamic assignment, no overlap`);
  console.log(`VEHICLE RETURN CRON: Every minute`);
});