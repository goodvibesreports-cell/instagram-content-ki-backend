const express = require("express");
const auth = require("../middleware/auth");
const { validate, seriesSchema, episodeStatusSchema, performanceSchema } = require("../validators/schemas.js");
const {
  listSeries,
  createSeries,
  updateEpisodeStatus,
  addPerformance
} = require("../controllers/seriesController.js");

const router = express.Router();

router.get("/", auth, listSeries);
router.post("/", auth, validate(seriesSchema), createSeries);
router.put("/episode", auth, validate(episodeStatusSchema), updateEpisodeStatus);
router.post("/performance", auth, validate(performanceSchema), addPerformance);

module.exports = router;