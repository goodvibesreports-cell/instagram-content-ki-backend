"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
var _logger = require("../utils/logger.js");
async function sendVerificationEmail(email, token) {
  _logger.logger.info("Mock verification email", {
    email,
    verificationLink: `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify?token=${token}`
  });
}
async function sendWelcomeEmail(email) {
  _logger.logger.info("Mock welcome email", {
    email
  });
}