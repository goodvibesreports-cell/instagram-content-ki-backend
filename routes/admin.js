import express from "express";
import auth from "../middleware/auth.js";
import { createSuccessResponse, createErrorResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import { cacheService } from "../services/cacheService.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import GeneratedContent from "../models/GeneratedContent.js";

const router = express.Router();

// Admin Check Middleware
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Admin-Zugriff erforderlich"));
  }
  next();
}

// ==============================
// Dashboard Stats
// ==============================
router.get("/stats", auth, adminOnly, async (req, res) => {
  try {
    // User Stats
    const userStats = await User.getStats();
    
    // Content Stats
    const contentStats = await GeneratedContent.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          avgTokens: { $avg: "$metadata.tokens" }
        }
      }
    ]);
    
    // Recent Activity (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsers = await User.countDocuments({ "usage.lastActiveAt": { $gte: oneDayAgo } });
    const recentGenerations = await GeneratedContent.countDocuments({ createdAt: { $gte: oneDayAgo } });
    
    // Cache Stats
    const cacheStats = await cacheService.getStats();
    
    // Posts Stats
    const totalPosts = await Post.countDocuments();
    
    // Revenue Estimation (based on premium users)
    const premiumUsers = await User.countDocuments({ premium: true });
    const estimatedMRR = premiumUsers * 9.99; // Assuming $9.99/month avg
    
    return res.json(createSuccessResponse({
      users: {
        total: userStats.totalUsers || 0,
        premium: userStats.premiumUsers || 0,
        byTier: userStats.byTier || [],
        activeToday: recentUsers
      },
      content: {
        totalGenerations: contentStats.reduce((sum, c) => sum + c.count, 0),
        byType: contentStats,
        generationsToday: recentGenerations,
        totalPosts
      },
      performance: {
        cache: cacheStats,
        uptime: process.uptime()
      },
      revenue: {
        estimatedMRR,
        premiumConversion: userStats.totalUsers > 0 
          ? ((userStats.premiumUsers / userStats.totalUsers) * 100).toFixed(2) + "%" 
          : "0%"
      }
    }));

  } catch (err) {
    logger.error("Admin stats error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// User Management
// ==============================
router.get("/users", auth, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50, tier, search } = req.query;
    
    const query = {};
    if (tier) query.premiumTier = tier;
    if (search) {
      query.email = { $regex: search, $options: "i" };
    }
    
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    return res.json(createSuccessResponse({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    }));

  } catch (err) {
    logger.error("Get users error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// Update User (Admin)
router.put("/users/:id", auth, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { credits, bonusCredits, premiumTier, premium, role } = req.body;
    
    const updateData = {};
    if (credits !== undefined) updateData.credits = credits;
    if (bonusCredits !== undefined) updateData.bonusCredits = bonusCredits;
    if (premiumTier) updateData.premiumTier = premiumTier;
    if (premium !== undefined) updateData.premium = premium;
    if (role) updateData.role = role;
    
    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
    
    if (!user) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "User nicht gefunden"));
    }
    
    logger.info(`Admin updated user ${user.email}`, { updateData });
    
    return res.json(createSuccessResponse({ user }, "User erfolgreich aktualisiert"));

  } catch (err) {
    logger.error("Update user error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// Cache Management
// ==============================
router.get("/cache", auth, adminOnly, async (req, res) => {
  const stats = await cacheService.getStats();
  return res.json(createSuccessResponse({ stats }));
});

router.delete("/cache", auth, adminOnly, async (req, res) => {
  const { type } = req.query;
  await cacheService.invalidate(type || null);
  return res.json(createSuccessResponse(null, `Cache ${type || "komplett"} geleert`));
});

// ==============================
// System Health
// ==============================
router.get("/health", auth, adminOnly, async (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  return res.json(createSuccessResponse({
    status: "healthy",
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + " MB",
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + " MB"
    },
    node: process.version,
    env: process.env.NODE_ENV || "development"
  }));
});

export default router;


