import { logger } from "../utils/logger.js";

export async function sendVerificationEmail(email, token) {
  logger.info("Mock verification email", {
    email,
    verificationLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify?token=${token}`
  });
}

export async function sendWelcomeEmail(email) {
  logger.info("Mock welcome email", { email });
}

