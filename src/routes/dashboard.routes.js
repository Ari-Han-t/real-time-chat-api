const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { getOverview } = require("../controllers/dashboard.controller");

router.get("/overview", auth, getOverview);

module.exports = router;
