// Farbcodes für Terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m"
};

// Log Levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Aktuelles Log Level (kann via ENV gesetzt werden)
const currentLevel = LogLevel[process.env.LOG_LEVEL?.toUpperCase()] ?? LogLevel.INFO;

function getTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, emoji, color, message, meta = null) {
  const timestamp = `${colors.gray}[${getTimestamp()}]${colors.reset}`;
  const levelStr = `${color}${level}${colors.reset}`;
  const metaStr = meta ? ` ${colors.gray}${JSON.stringify(meta)}${colors.reset}` : "";
  
  return `${timestamp} ${emoji} ${levelStr}: ${message}${metaStr}`;
}

export const logger = {
  debug(message, meta = null) {
    if (currentLevel <= LogLevel.DEBUG) {
      console.log(formatMessage("DEBUG", "🔍", colors.gray, message, meta));
    }
  },

  info(message, meta = null) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(formatMessage("INFO", "ℹ️", colors.blue, message, meta));
    }
  },

  success(message, meta = null) {
    if (currentLevel <= LogLevel.INFO) {
      console.log(formatMessage("SUCCESS", "✅", colors.green, message, meta));
    }
  },

  warn(message, meta = null) {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(formatMessage("WARN", "⚠️", colors.yellow, message, meta));
    }
  },

  error(message, meta = null) {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(formatMessage("ERROR", "❌", colors.red, message, meta));
    }
  },

  // Request Logger
  request(req, res, duration) {
    const status = res.statusCode;
    const color = status >= 500 ? colors.red : status >= 400 ? colors.yellow : colors.green;
    const method = `${colors.cyan}${req.method}${colors.reset}`;
    const path = req.originalUrl || req.url;
    const statusStr = `${color}${status}${colors.reset}`;
    const time = `${colors.gray}${duration}ms${colors.reset}`;
    
    console.log(`${colors.gray}[${getTimestamp()}]${colors.reset} ${method} ${path} ${statusStr} ${time}`);
  },

  // AI Generation Logger
  ai(action, details = {}) {
    const { model, tokens, duration, prompt } = details;
    console.log(formatMessage("AI", "🤖", colors.magenta, action, {
      model,
      tokens,
      duration: duration ? `${duration}ms` : undefined,
      promptLength: prompt?.length
    }));
  }
};

// Request Logging Middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.request(req, res, duration);
  });
  
  next();
}

export default logger;

