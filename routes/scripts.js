const express = require("express");
const { generateScripts } = require("../controllers/scriptsController.js");

const router = express.Router();

router.post("/generate-scripts", generateScripts);

module.exports = router;
