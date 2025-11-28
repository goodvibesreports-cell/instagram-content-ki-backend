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

    res.json(createSuccessResponse({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHistory
};

