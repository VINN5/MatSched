const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing in .env file!');
    process.exit(1);
  }
  console.log('Attempting to connect to MongoDB...');
  console.log('URI (first 20 chars):', uri.substring(0, 20) + '...');
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // Increase to 10 seconds
    });
    console.log('MongoDB Connected:', mongoose.connection.host);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
module.exports = connectDB;