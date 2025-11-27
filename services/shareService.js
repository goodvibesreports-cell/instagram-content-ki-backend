import { randomUUID } from "crypto";
import ShareLink from "../models/ShareLink.js";

export async function createShareLink(userId, payload, ttlDays = 30) {
  const token = randomUUID();
  const expiresAt = ttlDays ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null;

  const entry = await ShareLink.create({
    userId,
    token,
    payload,
    ...(expiresAt ? { expiresAt } : {})
  });

  return entry;
}

export async function getSharePayload(token) {
  const entry = await ShareLink.findOne({ token });
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    return null;
  }
  return entry.payload;
}


