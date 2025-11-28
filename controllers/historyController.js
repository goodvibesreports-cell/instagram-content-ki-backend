const History = require("../models/History.js");
const { createSuccessResponse } = require("../utils/errorHandler.js");

async function listHistory(req, res, next) {
  try {
    const { type, action, page, limit } = req.validated;
    const query = { userId: req.user.id };
    if (action) {
      query.action = action;
    } else if (type) {
      query.action = type;
    }

    const [items, total] = await Promise.all([
      History.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      History.countDocuments(query)
    ]);

    const payload = {
      history: items,
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    return res.json(createSuccessResponse(payload));
  } catch (err) {
    console.error("[HISTORY] Fehler beim Laden:", err);
    return res.json({
      success: false,
      message: "Verlauf konnte nicht geladen werden",
      history: [],
      items: [],
      pagination: {
        page: req.validated?.page || 1,
        limit: req.validated?.limit || 20,
        total: 0,
        pages: 0
      }
    });
  }
}

module.exports = {
  listHistory
};

