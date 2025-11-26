import express from "express";
import auth from "../middleware/auth.js";
import { validate, creatorProfileSchema } from "../validators/schemas.js";
import { getProfile, upsertProfile } from "../controllers/creatorController.js";

const router = express.Router();

router.get("/", auth, getProfile);
router.post("/", auth, validate(creatorProfileSchema), upsertProfile);

export default router;

