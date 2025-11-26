import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import CreatorProfile from "../models/CreatorProfile.js";
import { sendWelcomeEmail } from "./emailService.js";

const TOKEN_TTL = "7d";

function ensureJwt() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
}

function signToken(user) {
  ensureJwt();
  return jwt.sign(
    { id: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function mapCreatorProfile(profileDoc) {
  if (!profileDoc || typeof profileDoc !== "object") {
    return null;
  }
  const profile = profileDoc.toObject?.({ virtuals: true }) ?? profileDoc;
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
  const user = userDoc.toObject?.({ virtuals: true }) ?? userDoc;
  const totalCredits = typeof user.totalCredits === "number"
    ? user.totalCredits
    : (user.credits || 0) + (user.bonusCredits || 0);

  return {
    id: user._id?.toString?.() ?? user.id,
    email: user.email,
    verified: user.verified,
    platformMode: user.platformMode,
    credits: user.credits,
    bonusCredits: user.bonusCredits,
    totalCredits,
    usage: user.usage || {},
    settings: user.settings || {},
    creatorProfile: mapCreatorProfile(user.creatorProfile),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildAuthPayload(user) {
  return {
    token: signToken(user),
    user: mapUser(user)
  };
}

function throwHttpError(message, status) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

export async function registerUser({ email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throwHttpError("User existiert bereits", 400);
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    password: hashed,
    verified: true,
    verificationToken: null,
    verificationTokenExpires: null
  });

  await user.populate("creatorProfile");
  await sendWelcomeEmail(user.email).catch(() => {});

  return buildAuthPayload(user);
}

export async function verifyUser(token) {
  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    throwHttpError("Token ungültig oder abgelaufen", 400);
  }

  user.verified = true;
  user.verificationToken = null;
  user.verificationTokenExpires = null;
  await user.save();
  await user.populate("creatorProfile");
  await sendWelcomeEmail(user.email).catch(() => {});

  return buildAuthPayload(user);
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).populate("creatorProfile");
  if (!user) {
    throwHttpError("Ungültige Anmeldedaten", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throwHttpError("Ungültige Anmeldedaten", 401);
  }

  if (!user.verified) {
    user.verified = true;
    await user.save();
  }

  return buildAuthPayload(user);
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId).populate("creatorProfile");
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  return mapUser(user);
}

export async function upsertCreatorProfile(userId, payload) {
  const profile = await CreatorProfile.findOneAndUpdate(
    { userId },
    { ...payload, userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await User.findByIdAndUpdate(userId, { creatorProfile: profile._id });
  return profile;
}

export async function updatePlatformMode(userId, mode) {
  const user = await User.findById(userId).populate("creatorProfile");
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }
  user.platformMode = mode;
  await user.save();
  return mapUser(user);
}

export async function updatePassword(userId, currentPassword, newPassword) {
  const user = await User.findById(userId);
  if (!user) {
    throwHttpError("Benutzer nicht gefunden", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throwHttpError("Aktuelles Passwort ist falsch", 401);
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  return true;
}