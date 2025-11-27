import express from "express";
import { generateScripts } from "../controllers/scriptsController.js";

const router = express.Router();

router.post("/generate-scripts", generateScripts);

export default router;
