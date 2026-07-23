const mongoose = require('mongoose');

const connectDB = async () => {
  const connStr = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ai_task_db';
  try {
    const conn = await mongoose.connect(connStr);
    return conn;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

module.exports = connectDB;
