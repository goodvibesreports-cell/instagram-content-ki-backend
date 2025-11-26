import express from "express";
import auth from "../middleware/auth.js";
import {
  validate,
  registerSchema,
  loginSchema,
  verifySchema,
  platformModeSchema,
  changePasswordSchema
} from "../validators/schemas.js";
import {
  register,
  login,
  verify,
  me,
  setPlatformMode,
  changePassword
} from "../controllers/authController.js";

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/verify", validate(verifySchema), verify);
router.post("/login", validate(loginSchema), login);
router.get("/me", auth, me);
router.put("/platform-mode", auth, validate(platformModeSchema), setPlatformMode);
router.put("/password", auth, validate(changePasswordSchema), changePassword);

export default router;
