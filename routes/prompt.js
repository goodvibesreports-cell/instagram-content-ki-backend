import express from "express";
import { generatePrompt } from "../controllers/promptController.js";

const router = express.Router();

router.post("/generate-prompt", generatePrompt);

export default router;
