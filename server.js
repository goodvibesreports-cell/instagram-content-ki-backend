const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const uploadRoutes = require("./routes/upload.js");
const authRoutes = require("./routes/auth.js");
const adminRoutes = require("./routes/admin.js");
const aiRoutes = require("./routes/ai.js");
const batchRoutes = require("./routes/batch.js");
const calendarRoutes = require("./routes/calendar.js");
const creatorRoutes = require("./routes/creator.js");
const exportRoutes = require("./routes/export.js");
const historyRoutes = require("./routes/history.js");
const promptRoutes = require("./routes/prompt.js");
const scriptsRoutes = require("./routes/scripts.js");
const seriesRoutes = require("./routes/series.js");
const settingsRoutes = require("./routes/settings.js");
const shareRoutes = require("./routes/share.js");
const teamRoutes = require("./routes/team.js");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
  })
);
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(express.raw({ limit: "500mb", type: () => true }));

app.use((req, res, next) => {
  req.setTimeout(600_000);
  res.setTimeout(600_000);
  next();
});

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch((err) => {
    console.error("❌ Mongo Fehler:", err);
    process.exit(1);
  });

app.use("/upload", uploadRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/ai", aiRoutes);
app.use("/batch", batchRoutes);
app.use("/calendar", calendarRoutes);
app.use("/creator", creatorRoutes);
app.use("/export", exportRoutes);
app.use("/history", historyRoutes);
app.use("/prompt", promptRoutes);
app.use("/scripts", scriptsRoutes);
app.use("/series", seriesRoutes);
app.use("/settings", settingsRoutes);
app.use("/share", shareRoutes);
app.use("/team", teamRoutes);

app.get("/", (req, res) => {
  res.send("CreatorOS Backend läuft 🚀");
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Interner Serverfehler"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend läuft auf Port ${PORT}`);
});


