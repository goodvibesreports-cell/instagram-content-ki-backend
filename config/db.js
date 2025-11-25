import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // In Produktion: autoIndex deaktivieren für bessere Performance
    // Indexe sollten manuell in der DB erstellt werden
    const options = {
      autoIndex: process.env.NODE_ENV !== "production"
    };
    
    await mongoose.connect(process.env.MONGO_URI, options);
    console.log("✅ MongoDB Connected!");
    
    // Unterdrücke doppelte Index-Warnungen
    mongoose.set("strictQuery", true);
    
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
};
