const express = require("express");
const auth = require("../middleware/auth.js");
const { validate, creatorProfileSchema } = require("../validators/schemas.js");
const { getProfile, upsertProfile } = require("../controllers/creatorController.js");

const router = express.Router();

router.get("/", auth, getProfile);
router.post("/", auth, validate(creatorProfileSchema), upsertProfile);

module.exports = router;