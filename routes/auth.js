import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// ==============================
// REGISTER
// ==============================
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validierung
    if (!email || !password) {
      return res.status(400).json(createErrorResponse("AUTH_MISSING_CREDENTIALS"));
    }

    // Email-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Ungültige E-Mail-Adresse"));
    }

    // Passwort-Stärke prüfen
    if (password.length < 6) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Passwort muss mindestens 6 Zeichen haben"));
    }

    // Prüfen ob User existiert
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json(createErrorResponse("AUTH_USER_EXISTS"));
    }

    // Passwort hashen und User erstellen
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ 
      email: email.toLowerCase(), 
      password: hashed 
    });

    logger.success(`New user registered: ${email}`);

    return res.status(201).json(createSuccessResponse({
      userId: user._id
    }, "Registrierung erfolgreich! Du kannst dich jetzt einloggen."));

  } catch (err) {
    logger.error("Registration error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// LOGIN
// ==============================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validierung
    if (!email || !password) {
      return res.status(400).json(createErrorResponse("AUTH_MISSING_CREDENTIALS"));
    }

    // User suchen
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json(createErrorResponse("AUTH_INVALID_CREDENTIALS"));
    }

    // Passwort prüfen
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json(createErrorResponse("AUTH_INVALID_CREDENTIALS"));
    }

    // JWT erstellen
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    logger.success(`User logged in: ${email}`);

    return res.json(createSuccessResponse({
      token,
      user: {
        id: user._id,
        email: user.email
      }
    }, "Login erfolgreich!"));

  } catch (err) {
    logger.error("Login error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// GET CURRENT USER
// ==============================
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "Benutzer nicht gefunden"));
    }

    return res.json(createSuccessResponse({
      id: user._id,
      email: user.email,
      createdAt: user.createdAt
    }));

  } catch (err) {
    logger.error("Get user error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

// ==============================
// UPDATE PASSWORD
// ==============================
router.put("/password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Aktuelles und neues Passwort erforderlich"));
    }

    if (newPassword.length < 6) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Neues Passwort muss mindestens 6 Zeichen haben"));
    }

    const user = await User.findById(req.user.id);
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json(createErrorResponse("AUTH_INVALID_CREDENTIALS", "Aktuelles Passwort ist falsch"));
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    await user.save();

    logger.success(`Password updated for user: ${user.email}`);

    return res.json(createSuccessResponse(null, "Passwort erfolgreich geändert"));

  } catch (err) {
    logger.error("Password update error", { error: err.message });
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", err.message));
  }
});

export default router;
