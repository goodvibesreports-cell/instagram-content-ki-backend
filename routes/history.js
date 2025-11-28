const express = require("express");
const auth = require("../middleware/auth");
const { validate, historyQuerySchema } = require("../validators/schemas.js");
const { listHistory } = require("../controllers/historyController.js");

const router = express.Router();

router.get("/", auth, validate(historyQuerySchema), listHistory);

module.exports = router;