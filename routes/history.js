import express from "express";
import auth from "../middleware/auth.js";
import { validate, historyQuerySchema } from "../validators/schemas.js";
import { listHistory } from "../controllers/historyController.js";

const router = express.Router();

router.get("/", auth, validate(historyQuerySchema), listHistory);

export default router;

