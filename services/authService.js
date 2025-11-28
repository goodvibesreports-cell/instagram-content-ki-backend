"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCurrentUser = getCurrentUser;
exports.loginUser = loginUser;
exports.provisionTestAccount = provisionTestAccount;
exports.refreshAuthSession = refreshAuthSession;
exports.registerUser = registerUser;
exports.revokeSessions = revokeSessions;
exports.updatePassword = updatePassword;
exports.updatePlatformMode = updatePlatformMode;
exports.upsertCreatorProfile = upsertCreatorProfile;
exports.verifyUser = verifyUser;
var _bcryptjs = _interopRequireDefault(require("bcryptjs"));
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _crypto = _interopRequireDefault(require("crypto"));
var _User = _interopRequireDefault(require("../models/User"));
var _CreatorProfile = _interopRequireDefault(require("../models/CreatorProfile.js"));
var _emailService = require("./emailService.js");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 3600);
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = Number(process.env.AUTH_SESSION_LIMIT || 10);
const MAX_FAILED_ATTEMPTS = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 5);
const ACCOUNT_LOCK_DURATION_MS = Number(process.env.AUTH_LOCK_DURATION_MS || 15 * 60 * 1000);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
function ensureJwt() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
}
function ensureEncryptionKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY not configured");
  }
}
function signToken(user) {
  ensureJwt();
  return _jsonwebtoken.default.sign({
    id: user._id.toString(),
    email: user.email
  }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS
  });
}
function generateRefreshToken() {
  return _crypto.default.randomBytes(48).toString("hex");
}
function hashRefreshToken(token) {
  ensureEncryptionKey();
  return _crypto.default.createHmac("sha256", ENCRYPTION_KEY).update(token).digest("hex");
}
function sanitizeDevice(device = "unknown") {
  return device.substring(0, 160);
}
function sanitizeIp(ip = "") {
  return ip.substring(0, 60);
}
function buildSessionBundle(user, meta = {}, options = {}) {
  const now = new Date();
  const accessToken = signToken(user);
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const sessionId = options.sessionId || _crypto.default.randomUUID();
  const createdAt = options.createdAt || now;
  const sessionRecord = {
    sessionId,
    tokenHash: hashRefreshToken(refreshToken),
    device: sanitizeDevice(meta.device || "unknown"),
    ip: sanitizeIp(meta.ip || ""),
    createdAt,
    updatedAt: now,
    lastUsedAt: now,
    expiresAt: refreshExpiresAt
  };
  return {
    tokens: {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshExpiresAt
    },
    sessionRecord,
    publicSession: {
      id: sessionId,
      device: sessionRecord.device,
      ip: sessionRecord.ip,
      createdAt,
      expiresAt: refreshExpiresAt
    }
  };
}
function pruneSessions(user) {
  if (!Array.isArray(user.sessions)) {
    user.sessions = [];
    return;
  }
  const now = Date.now();
  user.sessions = user.sessions.filter(session => {
    if (!session?.expiresAt) {
      return false;
    }
    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt.getTime() : new Date(session.expiresAt).getTime();
    return expiresAt > now;
  });
}
function resetSecurityState(user, {
  markLogin = false
} = {}) {
  user.security = user.security || {};
  user.security.failedLoginAttempts = 0;
  user.security.lockedUntil = null;
  if (markLogin) {
    user.security.lastLoginAt = new Date();
  }
}
async function issueAuthResponse(user, meta = {}, options = {}) {
  const bundle = buildSessionBundle(user, meta, options);
  pruneSessions(user);
  user.sessions = user.sessions || [];
  if (options.sessionId) {
    const replaced = user.sessions.some(session => session.sessionId === options.sessionId);
    if (replaced) {
      user.sessions = user.sessions.map(session => session.sessionId === options.sessionId ? bundle.sessionRecord : session);
    } else {
      user.sessions.push(bundle.sessionRecord);
    }
  } else {
    user.sessions.push(bundle.sessionRecord);
  }
  if (user.sessions.length > MAX_SESSIONS_PER_USER) {
    user.sessions = user.sessions.slice(-MAX_SESSIONS_PER_USER);
  }
  user.markModified?.("sessions");
  resetSecurityState(user, {
    markLogin: options.markLogin !== false
  });
  await user.save();
  await user.populate?.("creatorProfile");
  return buildAuthPayload(user, bundle);
}
function mapCreatorProfile(profileDoc) {
  if (!profileDoc || typeof profileDoc !== "object") {
    return null;
  }
  const profile = profileDoc.toObject?.({
    virtuals: true
  }) ?? profileDoc;
  if (!profile.niche) {
    return null;
  }
  return {
    id: profile._id?.toString?.() ?? profile.id,
    niche: profile.niche,
    toneOfVoice: profile.toneOfVoice,
    targetAudience: profile.targetAudience,
    contentGoals: profile.contentGoals,
    exampleHooks: profile.exampleHooks,
    exampleCaptions: profile.exampleCaptions,
    bannedWords: profile.bannedWords,
    creatorStatement: profile.creatorStatement,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}
function mapUser(userDoc) {
  if (!userDoc) {
    return null;
  }
  const user = userDoc.toObject?.({
    virtuals: true
  }) ?? userDoc;
  const totalCredits = typeof user.totalCredits === "number" ? user.totalCredits : (user.credits || 0) + (user.bonusCredits || 0);
  return {
    id: user._id?.toString?.() ?? user.id,
    email: user.email,
    verified: user.verified,
    platformMode: user.platformMode,
    credits: user.credits,
    bonusCredits: user.bonusCredits,
    totalCredits,
    organization: user.organization ? user.organization.toString?.() ?? user.organization : null,
    usage: user.usage || {},
    settings: user.settings || {},
    creatorProfile: mapCreatorProfile(user.creatorProfile),
    security: {
      lastLoginAt: user.security?.lastLoginAt || null,
      lockedUntil: user.security?.lockedUntil || null
    },
    sessionCount: Array.isArray(user.sessions) ? user.sessions.length : 0,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
function buildAuthPayload(user, bundle) {
  return {
    ...(bundle ? {
      tokens: {
        accessToken: bundle.tokens.accessToken,
        expiresIn: bundle.tokens.expiresIn,
        refreshToken: bundle.tokens.refreshToken,
        refreshExpiresAt: bundle.tokens.refreshExpiresAt
      },
      session: bundle.publicSession
    } : {}),
    user: mapUser(user)
  };
}
function throwHttpError(message, status) {
  const err = new Error(message);
  err.status = status;
  throw err;
}
function ensureAccountUnlocked(user) {
  const lockedUntil = user.security?.lockedUntil;
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    const err = new Error("Account vorübergehend gesperrt. Bitte später erneut versuchen.");
    err.status = 423;
    throw err;
  }
}
async function markFailedLogin(user) {
  user.security = user.security || {};
  user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
  user.security.lastFailedLoginAt = new Date();
  if (user.security.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.security.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
    user.security.failedLoginAttempts = 0;
  }
  await user.save();
}
async function registerUser({
  email,
  password
}, meta = {}) {
  const existing = await _User.default.findOne({
    email
  });
  if (existing) {
    throwHttpError("User existiert bereits", 400);
  }
  const hashed = await _bcryptjs.default.hash(password, 12);
  const user = await _User.default.create({
    email,
    password: hashed,
    verified: true,
    verificationToken: null,
    verificationTokenExpires: null
  });
  await (0, _emailService.sendWelcomeEmail)(user.email).catch(() => {});
  return issueAuthResponse(user, meta, {
    markLogin: true
  });
}
async function verifyUser(token, meta = {}) {
  const user = await _User.default.findOne({
    verificationToken: token,
    verificationTokenExpires: {
      $gt: new Date()
    }
  });
  if (!user) {
    throwHttpError("Token ungültig oder abgelaufen", 400);
  }
  user.verified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();
  await (0, _emailService.sendWelcomeEmail)(user.email).catch(() => {});
  return issueAuthResponse(user, meta, {
    markLogin: true
  });
}
async function loginUser({
  email,
  password
}, meta = {}) {
  const user = await _User.default.findOne({
    email
  });
  if (!user) {
    throwHttpError("Ungültige Anmeldedaten", 401);
  }
  ensureAccountUnlocked(user);
  const isMatch = await _bcryptjs.default.compare(password, user.password);
  if (!isMatch) {
    await markFailedLogin(user);
    throwHttpError("Ungültige Anmeldedaten", 401);
  }
  if (!user.verified) {
    user.verified = true;
  }
  return issueAuthResponse(user, meta, {
    markLogin: true
  });
}
async function getCurrentUser(userId) {
  const user = await _User.default.findById(userId).populate("creatorProfile");
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  return mapUser(user);
}
async function upsertCreatorProfile(userId, payload) {
  const profile = await _CreatorProfile.default.findOneAndUpdate({
    userId
  }, {
    ...payload,
    userId
  }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  });
  await _User.default.findByIdAndUpdate(userId, {
    creatorProfile: profile._id
  });
  return profile;
}
async function updatePlatformMode(userId, mode) {
  const user = await _User.default.findById(userId).populate("creatorProfile");
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  user.platformMode = mode;
  await user.save();
  return mapUser(user);
}
async function updatePassword(userId, currentPassword, newPassword) {
  const user = await _User.default.findById(userId);
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  const isMatch = await _bcryptjs.default.compare(currentPassword, user.password);
  if (!isMatch) {
    throwHttpError("Aktuelles Passwort ist falsch", 401);
  }
  user.password = await _bcryptjs.default.hash(newPassword, 12);
  await user.save();
  return true;
}
async function provisionTestAccount({
  email,
  password,
  credits = 10000
}, meta = {}) {
  let user = await _User.default.findOne({
    email
  });
  const hashed = await _bcryptjs.default.hash(password, 12);
  if (user) {
    user.password = hashed;
    user.credits = credits;
    user.bonusCredits = 0;
    user.verified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
  } else {
    user = await _User.default.create({
      email,
      password: hashed,
      credits,
      bonusCredits: 0,
      verified: true,
      verificationToken: null,
      verificationTokenExpires: null
    });
  }
  return issueAuthResponse(user, meta, {
    markLogin: true
  });
}
async function refreshAuthSession(refreshToken, meta = {}) {
  if (!refreshToken) {
    throwHttpError("Refresh Token erforderlich", 400);
  }
  const tokenHash = hashRefreshToken(refreshToken);
  const user = await _User.default.findOne({
    "sessions.tokenHash": tokenHash
  });
  if (!user) {
    throwHttpError("Refresh Token ungültig", 401);
  }
  const existingSession = (user.sessions || []).find(session => session.tokenHash === tokenHash);
  if (!existingSession) {
    throwHttpError("Session nicht gefunden", 401);
  }
  const expiresAt = existingSession.expiresAt instanceof Date ? existingSession.expiresAt.getTime() : new Date(existingSession.expiresAt).getTime();
  if (expiresAt <= Date.now()) {
    user.sessions = user.sessions.filter(session => session.sessionId !== existingSession.sessionId);
    await user.save();
    throwHttpError("Session abgelaufen", 401);
  }
  return issueAuthResponse(user, meta, {
    sessionId: existingSession.sessionId,
    createdAt: existingSession.createdAt,
    markLogin: false
  });
}
async function revokeSessions(userId, refreshToken = null, fromAllDevices = false) {
  const user = await _User.default.findById(userId);
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  if (fromAllDevices || !refreshToken) {
    user.sessions = [];
  } else {
    const tokenHash = hashRefreshToken(refreshToken);
    user.sessions = (user.sessions || []).filter(session => session.tokenHash !== tokenHash);
  }
  await user.save();
  return true;
}