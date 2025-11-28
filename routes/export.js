const express = require("express");
const auth = require("../middleware/auth");
const { generateInsightsPdf, generateInsightsCsv } = require("../services/exportService.js");
const { createErrorResponse } = require("../utils/errorHandler.js");

const router = express.Router();

router.post("/pdf", auth, async (req, res) => {
  try {
    const buffer = await generateInsightsPdf(req.body || {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="tiktok_insights.pdf"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("PDF export error:", error);
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", "PDF export failed"));
  }
});

router.post("/csv", auth, async (req, res) => {
  try {
    const buffer = generateInsightsCsv(req.body?.posts || []);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="tiktok_analysis.csv"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("CSV export error:", error);
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", "CSV export failed"));
  }
});

module.exports = router;


