import {
  registerUser,
  verifyUser,
  loginUser,
  getCurrentUser,
  updatePlatformMode,
  updatePassword
} from "../services/authService.js";
import { createSuccessResponse } from "../utils/errorHandler.js";

export async function register(req, res, next) {
  try {
    const payload = await registerUser(req.validated);
    res.status(201).json(createSuccessResponse(payload, "Registrierung erfolgreich!"));
  } catch (err) {
    next(err);
  }
}

export async function verify(req, res, next) {
  try {
    const payload = await verifyUser(req.validated.token);
    res.json(createSuccessResponse(payload, "E-Mail bestätigt – du bist jetzt eingeloggt."));
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const payload = await loginUser(req.validated);
    res.json(createSuccessResponse(payload, "Login erfolgreich!"));
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);
    res.json(createSuccessResponse(user));
  } catch (err) {
    next(err);
  }
}

export async function setPlatformMode(req, res, next) {
  try {
    const user = await updatePlatformMode(req.user.id, req.validated.platform);
    res.json(createSuccessResponse(user, "Platform Mode aktualisiert"));
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await updatePassword(req.user.id, req.validated.currentPassword, req.validated.newPassword);
    res.json(createSuccessResponse(null, "Passwort erfolgreich geändert"));
  } catch (err) {
    next(err);
  }
}

