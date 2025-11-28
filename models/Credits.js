const mongoose = require("mongoose");

const creditsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalCredits: { type: Number, default: 0 },
    usedCredits: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Credits", creditsSchema);

