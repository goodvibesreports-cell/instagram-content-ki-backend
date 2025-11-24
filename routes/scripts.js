const express = require('express');
const router = express.Router();
const scriptsController = require('../controllers/scriptsController');

router.post('/generate-scripts', scriptsController.generateScripts);

module.exports = router;
