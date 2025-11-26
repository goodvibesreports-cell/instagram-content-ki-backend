import express from "express";
import auth from "../middleware/auth.js";
import { validate, seriesSchema, episodeStatusSchema, performanceSchema } from "../validators/schemas.js";
import { createSeries, listSeries, updateEpisodeStatus, addPerformance } from "../controllers/seriesController.js";

const router = express.Router();

router.get("/", auth, listSeries);
router.post("/", auth, validate(seriesSchema), createSeries);
router.put("/episode", auth, validate(episodeStatusSchema), updateEpisodeStatus);
router.post("/performance", auth, validate(performanceSchema), addPerformance);

export default router;

