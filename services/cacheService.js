import CryptoJS from "crypto-js";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

// ==============================
// Cache Schema (MongoDB-basiert)
// ==============================
const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  type: { type: String, enum: ["prompt", "video_idea", "hook", "caption", "trend", "virality", "batch"], required: true },
  hits: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 }
});

const Cache = mongoose.model("Cache", cacheSchema);

// ==============================
// Cache Service
// ==============================
class CacheService {
  constructor() {
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 Stunden
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0
    };
  }

  // Hash generieren für Cache-Key
  generateKey(type, input) {
    const normalized = typeof input === "string" 
      ? input.toLowerCase().trim() 
      : JSON.stringify(input);
    
    return `${type}:${CryptoJS.MD5(normalized).toString()}`;
  }

  // Aus Cache holen
  async get(type, input) {
    try {
      const key = this.generateKey(type, input);
      const cached = await Cache.findOneAndUpdate(
        { key, expiresAt: { $gt: new Date() } },
        { $inc: { hits: 1 } },
        { new: true }
      );

      if (cached) {
        this.stats.hits++;
        logger.debug(`Cache HIT: ${type}`, { key: key.substring(0, 20) });
        return cached.value;
      }

      this.stats.misses++;
      logger.debug(`Cache MISS: ${type}`, { key: key.substring(0, 20) });
      return null;
    } catch (err) {
      logger.error("Cache get error", { error: err.message });
      return null;
    }
  }

  // In Cache speichern
  async set(type, input, value, ttlMs = null) {
    try {
      const key = this.generateKey(type, input);
      const ttl = ttlMs || this.defaultTTL;
      
      await Cache.findOneAndUpdate(
        { key },
        {
          key,
          value,
          type,
          expiresAt: new Date(Date.now() + ttl),
          hits: 0
        },
        { upsert: true, new: true }
      );

      this.stats.saves++;
      logger.debug(`Cache SET: ${type}`, { key: key.substring(0, 20) });
      return true;
    } catch (err) {
      logger.error("Cache set error", { error: err.message });
      return false;
    }
  }

  // Cache invalidieren
  async invalidate(type, input = null) {
    try {
      if (input) {
        const key = this.generateKey(type, input);
        await Cache.deleteOne({ key });
      } else {
        await Cache.deleteMany({ type });
      }
      logger.info(`Cache invalidated: ${type}`);
      return true;
    } catch (err) {
      logger.error("Cache invalidate error", { error: err.message });
      return false;
    }
  }

  // Statistiken abrufen
  async getStats() {
    const totalEntries = await Cache.countDocuments();
    const byType = await Cache.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 }, totalHits: { $sum: "$hits" } } }
    ]);

    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      totalEntries,
      byType
    };
  }

  // Cleanup abgelaufener Einträge (falls TTL Index nicht greift)
  async cleanup() {
    try {
      const result = await Cache.deleteMany({ expiresAt: { $lt: new Date() } });
      logger.info(`Cache cleanup: ${result.deletedCount} entries removed`);
      return result.deletedCount;
    } catch (err) {
      logger.error("Cache cleanup error", { error: err.message });
      return 0;
    }
  }
}

export const cacheService = new CacheService();
export default cacheService;

