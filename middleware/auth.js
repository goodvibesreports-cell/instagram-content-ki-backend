import jwt from "jsonwebtoken";
import { createErrorResponse } from "../utils/errorHandler.js";

export default function auth(req, res, next) {
  try {
    const header = req.header("Authorization");
    
    if (!header) {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_MISSING"));
    }

    const token = header.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_MISSING"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
    
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_EXPIRED"));
    }
    return res.status(401).json(createErrorResponse("AUTH_TOKEN_INVALID"));
  }
}

// Optional: Middleware die nicht blockiert (für optionale Auth)
export function optionalAuth(req, res, next) {
  try {
    const header = req.header("Authorization");
    
    if (header) {
      const token = header.replace("Bearer ", "");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch {
    // Token ungültig, aber trotzdem weitermachen
    next();
  }
}
