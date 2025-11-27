import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createRequire } from "module";
import uploadRoutes from "./routes/upload.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";
import batchRoutes from "./routes/batch.js";
import calendarRoutes from "./routes/calendar.js";
import creatorRoutes from "./routes/creator.js";
import exportRoutes from "./routes/export.js";
import historyRoutes from "./routes/history.js";
import seriesRoutes from "./routes/series.js";
import settingsRoutes from "./routes/settings.js";
import shareRoutes from "./routes/share.js";
import teamRoutes from "./routes/team.js";

const require = createRequire(import.meta.url);
const promptRoutes = require("./routes/prompt.js");
const scriptsRoutes = require("./routes/scripts.js");

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
  })
);
app.use(express.json({ limit: "250mb" }));
app.use(express.urlencoded({ extended: true, limit: "250mb" }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
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
app.use("/prompt", promptRoutes);
app.use("/scripts", scriptsRoutes);

app.get("/", (req, res) => {
  res.send("CreatorOS Backend läuft 🚀");
});

// global error handler
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


