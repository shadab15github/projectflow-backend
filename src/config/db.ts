import mongoose from "mongoose";

async function dropLegacyTasks(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const collections = await db.listCollections({ name: "tasks" }).toArray();
    if (collections.length === 0) return;
    await db.dropCollection("tasks");
    console.log("Dropped legacy 'tasks' collection (replaced by work_items).");
  } catch (error) {
    console.warn(
      `Could not drop legacy tasks collection: ${(error as Error).message}`,
    );
  }
}

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI as string);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    await dropLegacyTasks();
  } catch (error) {
    console.error(`MongoDB connection error: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;
