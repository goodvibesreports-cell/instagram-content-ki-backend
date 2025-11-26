import History from "../models/History.js";
import { createSuccessResponse } from "../utils/errorHandler.js";

export async function listHistory(req, res, next) {
  try {
    const { type, page, limit } = req.validated;
    const query = { userId: req.user.id };
    if (type) query.type = type;

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

