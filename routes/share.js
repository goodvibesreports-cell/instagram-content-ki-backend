import express from "express";
import auth from "../middleware/auth.js";
import { createShareLink, getSharePayload } from "../services/shareService.js";
import { createErrorResponse, createSuccessResponse } from "../utils/errorHandler.js";

const router = express.Router();

router.post("/generate", auth, async (req, res) => {
  try {
    const payload = req.body?.payload;
    if (!payload || !payload.analysis) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Analysis payload fehlt"));
    }

    const entry = await createShareLink(req.user.id, payload);
    return res.json(
      createSuccessResponse({
        token: entry.token,
        expiresAt: entry.expiresAt,
        shareUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/share/${entry.token}`
      }, "Share-Link erstellt")
    );
  } catch (error) {
    console.error("Share link error:", error);
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", error.message));
  }
});

router.get("/:token", async (req, res) => {
  try {
    const payload = await getSharePayload(req.params.token);
    if (!payload) {
      return res.status(404).json(createErrorResponse("NOT_FOUND", "Share-Link ungültig oder abgelaufen"));
    }
    return res.json(createSuccessResponse({ payload }));
  } catch (error) {
    console.error("Share token error:", error);
    return res.status(500).json(createErrorResponse("INTERNAL_ERROR", error.message));
  }
});

export default router;


