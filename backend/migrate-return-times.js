// backend/migrate-return-times.js
require('dotenv').config(); // Works because node_modules is here
const connectDB = require('./config/db');
const Schedule = require('./models/schedule');
const Route = require('./models/route');

(async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Starting migration...\n');

    const schedules = await Schedule.find({
      expectedReturnTime: { $exists: false },
      status: { $in: ['scheduled', 'in_transit'] },
      isActive: true
    }).populate('route');

    if (schedules.length === 0) {
      console.log('No schedules need migration.');
      process.exit(0);
    }

    console.log(`Found ${schedules.length} schedules to update...\n`);

    let updated = 0;

    for (const sched of schedules) {
      const route = sched.route;
      const estimatedTime = route?.estimatedTime || 45;
      const departure = new Date(sched.departureTime);
      const hour = departure.getHours();

      const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
      const multiplier = isRushHour ? 1.8 : 1.0;

      const totalMins = Math.round(2 * estimatedTime * multiplier + 15);
      const expectedReturn = new Date(departure.getTime() + totalMins * 60 * 1000);

      await Schedule.updateOne(
        { _id: sched._id },
        { $set: { expectedReturnTime: expectedReturn } }
      );

      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated} schedules...`);
      }
    }

    console.log(`\nMigration complete: ${updated} schedules updated`);
    process.exit(0);
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  }
})();