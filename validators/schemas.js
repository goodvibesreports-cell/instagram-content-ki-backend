import { z } from "zod";

const PLATFORM_ENUM = ["instagram", "tiktok", "youtube", "twitter", "linkedin"];
const HOOK_STYLES = ["mixed", "question", "statement", "shocking", "story"];
const CAPTION_TONES = ["casual", "professional", "funny", "inspirational"];
const TITLE_STYLES = ["clickbait", "informative", "question", "how-to"];
const TREND_PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "linkedin", "all"];
const TREND_TIMEFRAMES = ["today", "week", "month"];
const VIRALITY_TYPES = ["hook", "caption", "script", "full"];

export const registerSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8)
});

export const testAccountSchema = registerSchema.extend({
  credits: z.coerce.number().int().min(0).max(1000000).optional()
});

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(40, "Refresh Token ist ungültig")
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(40, "Refresh Token ist ungültig").optional(),
  fromAllDevices: z.boolean().optional().default(false)
}).refine((value) => Boolean(value.refreshToken) || value.fromAllDevices === true, {
  message: "Refresh Token erforderlich, außer bei Logout von allen Geräten",
  path: ["refreshToken"]
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, "Aktuelles Passwort ist erforderlich"),
  newPassword: z.string().min(8, "Neues Passwort muss mindestens 8 Zeichen lang sein")
});

export const verifySchema = z.object({
  token: z.string().min(10)
});

export const platformModeSchema = z.object({
  platform: z.enum(PLATFORM_ENUM)
});

export const creatorProfileSchema = z.object({
  niche: z.string().min(3),
  toneOfVoice: z.string().min(3),
  targetAudience: z.string().optional(),
  contentGoals: z.array(z.string()).default([]),
  exampleHooks: z.array(z.string()).default([]),
  exampleCaptions: z.array(z.string()).default([]),
  bannedWords: z.array(z.string()).default([]),
  creatorStatement: z.string().optional()
});

export const generatePromptsSchema = z.object({
  topic: z.string().min(3),
  platform: z.enum(PLATFORM_ENUM),
  count: z.coerce.number().min(1).max(10).default(5)
});

export const generateVideoIdeasSchema = z.object({
  prompt: z.string().min(5),
  platform: z.enum(PLATFORM_ENUM)
});

export const analysisSchema = z.object({
  platform: z.enum(PLATFORM_ENUM),
  caption: z.string().min(10),
  metrics: z.object({
    views: z.coerce.number().optional(),
    likes: z.coerce.number().optional(),
    comments: z.coerce.number().optional(),
    saves: z.coerce.number().optional()
  }).optional()
});

export const seriesSchema = z.object({
  topic: z.string().min(3),
  platform: z.enum(PLATFORM_ENUM),
  episodes: z.coerce.number().min(5).max(30).default(10)
});

export const episodeStatusSchema = z.object({
  seriesId: z.string(),
  episodeId: z.string(),
  status: z.enum(["planned", "in_progress", "published", "analyzing"])
});

export const performanceSchema = z.object({
  episodeId: z.string(),
  seriesId: z.string(),
  views: z.coerce.number().nonnegative(),
  likes: z.coerce.number().nonnegative(),
  comments: z.coerce.number().nonnegative(),
  saves: z.coerce.number().nonnegative()
});

export const historyQuerySchema = z.object({
  type: z.enum(["analysis", "prompt", "script", "series"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20)
});

const uploadPostItemSchema = z.object({
  content: z.string().min(1).max(4000).optional(),
  text: z.string().min(1).max(4000).optional(),
  caption: z.string().min(1).max(4000).optional(),
  description: z.string().min(1).max(4000).optional(),
  hashtags: z.array(z.string().min(1).max(80)).max(50).optional(),
  likes: z.coerce.number().nonnegative().optional(),
  likeCount: z.coerce.number().nonnegative().optional(),
  comments: z.coerce.number().nonnegative().optional(),
  commentCount: z.coerce.number().nonnegative().optional(),
  engagement: z.coerce.number().nonnegative().optional(),
  category: z.string().min(2).max(50).optional()
}).refine((value) => value.content || value.text || value.caption || value.description, {
  message: "Jeder Post benötigt mindestens ein Textfeld (content/text/caption/description)"
});

export const uploadPostsSchema = z.array(uploadPostItemSchema).min(1).max(500);

// ==============================
// Advanced AI Schemas
// ==============================

export const generateHooksSchema = z.object({
  topic: z.string().min(3),
  count: z.coerce.number().min(1).max(20).default(10),
  style: z.enum(HOOK_STYLES).default("mixed")
});

export const generateCaptionsSchema = z.object({
  topic: z.string().min(3),
  tone: z.enum(CAPTION_TONES).default("casual"),
  includeEmojis: z.boolean().optional().default(true),
  includeHashtags: z.boolean().optional().default(true),
  count: z.coerce.number().min(1).max(10).default(3)
});

export const generateTitleSchema = z.object({
  topic: z.string().min(3),
  style: z.enum(TITLE_STYLES).default("clickbait"),
  count: z.coerce.number().min(1).max(20).default(5)
});

export const trendAnalysisSchema = z.object({
  niche: z.string().min(3),
  platform: z.enum(TREND_PLATFORMS).default("instagram"),
  timeframe: z.enum(TREND_TIMEFRAMES).default("week")
});

export const viralityAnalysisSchema = z.object({
  content: z.string().min(20),
  type: z.enum(VIRALITY_TYPES).default("full")
});

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({
      ...req.body,
      ...req.params,
      ...req.query
    });
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 5002,
          message: parsed.error.issues[0]?.message || "Validierung fehlgeschlagen",
          details: parsed.error.issues
        }
      });
    }
    req.validated = parsed.data;
    req.validatedBody = parsed.data;
    next();
  };
}
