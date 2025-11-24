const express = require('express');
const router = express.Router();
const promptController = require('../controllers/promptController');

router.post('/generate-prompt', promptController.generatePrompt);

module.exports = router;
