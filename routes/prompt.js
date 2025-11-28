const express = require("express");
const { generatePrompt } = require("../controllers/promptController.js");

const router = express.Router();

router.post("/generate-prompt", generatePrompt);

module.exports = router;
