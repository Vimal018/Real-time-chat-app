import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../models/messageModel';

dotenv.config();

async function migrateReadBy() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in .env file');
    }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const result = await Message.updateMany(
      { readBy: { $exists: false } },
      { $set: { readBy: [] } }
    );
    console.log(`Updated ${result.modifiedCount} messages with readBy`);

    console.log('readBy migration complete');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateReadBy();