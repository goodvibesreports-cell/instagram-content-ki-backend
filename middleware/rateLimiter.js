const rateLimit = require("express-rate-limit");
const { createErrorResponse } = require("../utils/errorHandler.js");

// ==============================
// Rate Limit Konfigurationen
// ==============================

// Generelles API Rate Limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // Max 100 Requests pro 15 Min
  message: createErrorResponse("AI_RATE_LIMITED", "Zu viele Anfragen. Bitte warte 15 Minuten."),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"] || "unknown"
});

// Auth Rate Limit (strenger)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Max 10 Login/Register Versuche pro 15 Min
  message: createErrorResponse("AI_RATE_LIMITED", "Zu viele Anmeldeversuche. Bitte warte 15 Minuten."),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Erfolgreiche Logins nicht zählen
});

// AI Generation Rate Limit
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 10, // Max 10 AI Requests pro Minute
  message: createErrorResponse("AI_RATE_LIMITED", "Zu viele KI-Anfragen. Bitte warte eine Minute."),
  standardHeaders: true,
  legacyHeaders: false
});

// Upload Rate Limit
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 20, // Max 20 Uploads pro Stunde
  message: createErrorResponse("AI_RATE_LIMITED", "Zu viele Uploads. Bitte warte eine Stunde."),
  standardHeaders: true,
  legacyHeaders: false
});

// Premium User Limiter (großzügiger)
const premiumAiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 30, // 30 AI Requests pro Minute für Premium
  message: createErrorResponse("AI_RATE_LIMITED", "Rate Limit erreicht. Bitte kurz warten."),
  standardHeaders: true,
  legacyHeaders: false
});

// Dynamischer Limiter basierend auf User-Tier
function dynamicLimiter(req, res, next) {
  const isPremium = req.user?.premium || false;
  
  if (isPremium) {
    return premiumAiLimiter(req, res, next);
  }
  return aiLimiter(req, res, next);
}

// IP-basiertes Abuse Detection
const suspiciousIPs = new Map();

function abuseDetection(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  
  // IP-Historie abrufen
  const history = suspiciousIPs.get(ip) || { count: 0, lastRequest: 0, blocked: false };
  
  // Wenn geblockt, prüfen ob Block abgelaufen
  if (history.blocked) {
    if (now - history.blockedAt < 60 * 60 * 1000) { // 1 Stunde Block
      return res.status(429).json(createErrorResponse("AI_RATE_LIMITED", "IP temporär gesperrt wegen verdächtigem Verhalten."));
    }
    history.blocked = false;
  }
  
  // Schnelle aufeinanderfolgende Requests erkennen
  if (now - history.lastRequest < 100) { // Weniger als 100ms zwischen Requests
    history.count++;
    
    if (history.count > 50) { // 50 schnelle Requests = Block
      history.blocked = true;
      history.blockedAt = now;
      suspiciousIPs.set(ip, history);
      return res.status(429).json(createErrorResponse("AI_RATE_LIMITED", "Verdächtiges Verhalten erkannt. IP temporär gesperrt."));
    }
  } else {
    // Reset wenn genug Zeit vergangen
    history.count = Math.max(0, history.count - 1);
  }
  
  history.lastRequest = now;
  suspiciousIPs.set(ip, history);
  
  // Cleanup alte Einträge alle 10 Minuten
  if (Math.random() < 0.001) {
    const tenMinutesAgo = now - 10 * 60 * 1000;
    for (const [key, value] of suspiciousIPs.entries()) {
      if (value.lastRequest < tenMinutesAgo && !value.blocked) {
        suspiciousIPs.delete(key);
      }
    }
  }
  
  next();
}

module.exports = {
  generalLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
  premiumAiLimiter,
  dynamicLimiter,
  abuseDetection
};
