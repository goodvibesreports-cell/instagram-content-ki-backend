// Standardisierte Error-Codes
export const ErrorCodes = {
  // Auth Errors (1xxx)
  AUTH_MISSING_CREDENTIALS: { code: 1001, message: "E-Mail und Passwort erforderlich", status: 400 },
  AUTH_USER_EXISTS: { code: 1002, message: "Benutzer existiert bereits", status: 400 },
  AUTH_INVALID_CREDENTIALS: { code: 1003, message: "Ungültige Anmeldedaten", status: 401 },
  AUTH_TOKEN_MISSING: { code: 1004, message: "Authentifizierung erforderlich", status: 401 },
  AUTH_TOKEN_INVALID: { code: 1005, message: "Ungültiger Token", status: 401 },
  AUTH_TOKEN_EXPIRED: { code: 1006, message: "Token abgelaufen", status: 401 },

  // Upload Errors (2xxx)
  UPLOAD_NO_FILE: { code: 2001, message: "Keine Datei hochgeladen", status: 400 },
  UPLOAD_INVALID_FORMAT: { code: 2002, message: "Ungültiges Dateiformat", status: 400 },
  UPLOAD_FILE_TOO_LARGE: { code: 2003, message: "Datei zu groß (max. 10MB)", status: 400 },
  UPLOAD_INVALID_JSON: { code: 2004, message: "Ungültiges JSON-Format", status: 400 },
  UPLOAD_EMPTY_ARRAY: { code: 2005, message: "JSON muss ein Array mit Posts sein", status: 400 },
  UPLOAD_FAILED: { code: 2006, message: "Upload fehlgeschlagen", status: 500 },

  // Post Errors (3xxx)
  POSTS_NOT_FOUND: { code: 3001, message: "Keine Posts gefunden", status: 404 },
  POSTS_EMPTY: { code: 3002, message: "Keine Posts vorhanden. Bitte zuerst Daten hochladen.", status: 400 },

  // AI Generation Errors (4xxx)
  AI_NO_PROMPTS: { code: 4001, message: "Keine Prompts angegeben", status: 400 },
  AI_GENERATION_FAILED: { code: 4002, message: "KI-Generierung fehlgeschlagen", status: 500 },
  AI_NO_RESPONSE: { code: 4003, message: "Keine Antwort von der KI erhalten", status: 500 },
  AI_RATE_LIMITED: { code: 4004, message: "Zu viele Anfragen. Bitte später erneut versuchen.", status: 429 },

  // General Errors (5xxx)
  INTERNAL_ERROR: { code: 5001, message: "Interner Serverfehler", status: 500 },
  VALIDATION_ERROR: { code: 5002, message: "Validierungsfehler", status: 400 },
  NOT_FOUND: { code: 5003, message: "Ressource nicht gefunden", status: 404 },
  DATABASE_ERROR: { code: 5004, message: "Datenbankfehler", status: 500 }
};

// Error Response Builder
export function createErrorResponse(errorType, details = null) {
  const error = ErrorCodes[errorType] || ErrorCodes.INTERNAL_ERROR;
  
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(details && { details })
    }
  };
}

// Success Response Builder
export function createSuccessResponse(data, message = null) {
  return {
    success: true,
    ...(message && { message }),
    data
  };
}

// Express Error Handler Middleware
export function errorMiddleware(err, req, res, next) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.stack || err.message}`);
  
  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    return res.status(400).json(createErrorResponse("VALIDATION_ERROR", err.message));
  }
  
  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    return res.status(400).json(createErrorResponse("AUTH_USER_EXISTS"));
  }
  
  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json(createErrorResponse("AUTH_TOKEN_INVALID"));
  }
  
  if (err.name === "TokenExpiredError") {
    return res.status(401).json(createErrorResponse("AUTH_TOKEN_EXPIRED"));
  }

  // OpenAI Rate Limit
  if (err.status === 429) {
    return res.status(429).json(createErrorResponse("AI_RATE_LIMITED"));
  }
  
  // Default Error
  const status = err.status || 500;
  return res.status(status).json(createErrorResponse("INTERNAL_ERROR", err.message));
}




