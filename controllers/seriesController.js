const Series = require("../models/Series.js");
const SeriesPerformance = require("../models/SeriesPerformance.js");
const History = require("../models/History.js");
const { generateSeriesBlueprint, calculateMomentum } = require("../services/aiService.js");
const { getCreatorProfile } = require("../services/creatorService.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

async function createSeries(req, res, next) {
  try {
    const profile = await getCreatorProfile(req.user.id);
    const blueprint = await generateSeriesBlueprint(req.userDoc, profile, req.validated);

    const episodes = blueprint.content
      ?.split("\n")
      .filter(Boolean)
      .slice(0, req.validated.episodes)
      .map((line) => ({
        title: line.replace(/^\d+[\).\s-]+/, "").slice(0, 120),
        hook: line,
        idea: line,
        status: "planned"
      })) || [];

    const series = await Series.create({
      userId: req.user.id,
      title: req.validated.topic,
      description: "Automatisch erstellt",
      platform: req.validated.platform,
      episodes
    });

    await History.create({
      userId: req.user.id,
      type: "series",
      platform: req.validated.platform,
      input: req.validated,
      output: blueprint.content
    });

    res.status(201).json(createSuccessResponse({ series, blueprint }));
  } catch (err) {
    next(err);
  }
}

async function listSeries(req, res, next) {
  try {
    const series = await Series.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(createSuccessResponse({ series }));
  } catch (err) {
    next(err);
  }
}

async function updateEpisodeStatus(req, res, next) {
  try {
    const { seriesId, episodeId, status } = req.validated;
    const series = await Series.findOne({ _id: seriesId, userId: req.user.id });
    if (!series) {
      const err = new Error("Serie nicht gefunden");
      err.status = 404;
      throw err;
    }
    const episode = series.episodes.id(episodeId);
    if (!episode) {
      const err = new Error("Episode nicht gefunden");
      err.status = 404;
      throw err;
    }
    episode.status = status;
    await series.save();
    res.json(createSuccessResponse({ series }));
  } catch (err) {
    next(err);
  }
}

async function addPerformance(req, res, next) {
  try {
    const perf = await SeriesPerformance.create({
      userId: req.user.id,
      ...req.validated,
      score: calculateMomentum(req.validated)
    });
    res.status(201).json(createSuccessResponse({ performance: perf }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSeries,
  listSeries,
  updateEpisodeStatus,
  addPerformance
};

