import express from "express";
import { optionalAuth } from "../middleware/auth.js";
import { generateInsightsPdf, generateInsightsCsv } from "../services/exportService.js";
import { createErrorResponse } from "../utils/errorHandler.js";

const router = express.Router();

router.post("/pdf", optionalAuth, async (req, res) => {
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

router.post("/csv", optionalAuth, async (req, res) => {
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

export default router;


