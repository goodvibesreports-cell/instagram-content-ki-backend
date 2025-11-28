const express = require("express");
const auth = require("../middleware/auth.js");
const {
  validate,
  registerSchema,
  loginSchema,
  verifySchema,
  platformModeSchema,
  changePasswordSchema,
  testAccountSchema,
  refreshTokenSchema,
  logoutSchema
} = require("../validators/schemas.js");
const {
  register,
  login,
  verify,
  me,
  setPlatformMode,
  changePassword,
  registerTestAccount,
  refreshSession,
  logout
} = require("../controllers/authController.js");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/test-account", validate(testAccountSchema), registerTestAccount);
router.post("/verify", validate(verifySchema), verify);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refreshSession);
router.get("/me", auth, me);
router.put("/platform-mode", auth, validate(platformModeSchema), setPlatformMode);
router.put("/password", auth, validate(changePasswordSchema), changePassword);
router.post("/logout", auth, validate(logoutSchema), logout);

module.exports = router;
