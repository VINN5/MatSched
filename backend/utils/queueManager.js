// backend/utils/queueManager.js
const RouteQueue = require('../models/RouteQueue');
const Schedule = require('../models/schedule');
const { notifyDriver } = require('../server'); // or pass io

const assignNextVehicle = async (routeKey) => {
  const queueDoc = await RouteQueue.findOne({ routeKey });
  if (!queueDoc || queueDoc.queue.length === 0) return;

  const next = queueDoc.queue[0];
  next.status = 'assigned';
  queueDoc.activeVehicle = next.vehicle;
  await queueDoc.save();

  // Create schedule
  const schedule = await Schedule.create({
    sacco: next.driver.sacco,
    route: next.route,
    vehicle: next.vehicle,
    departureTime: new Date(Date.now() + 5 * 60 * 1000),
    seatsAvailable: 14,
    isActive: true
  });

  notifyDriver(next.driver.toString(), 'driver-assigned', {
    route: schedule.route,
    vehicle: next.vehicle,
    departureTime: schedule.departureTime,
    seatsAvailable: 14
  });
};

module.exports = { assignNextVehicle };