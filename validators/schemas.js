import { z } from "zod";

// ==============================
// Auth Schemas
// ==============================
export const registerSchema = z.object({
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .min(5, "E-Mail zu kurz")
    .max(100, "E-Mail zu lang")
    .transform(val => val.toLowerCase().trim()),
  password: z
    .string()
    .min(6, "Passwort muss mindestens 6 Zeichen haben")
    .max(100, "Passwort zu lang")
});

export const loginSchema = z.object({
  email: z
    .string()
    .email("Ungültige E-Mail-Adresse")
    .transform(val => val.toLowerCase().trim()),
  password: z
    .string()
    .min(1, "Passwort erforderlich")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
  newPassword: z.string().min(6, "Neues Passwort muss mindestens 6 Zeichen haben")
});

// ==============================
// Post Upload Schemas
// ==============================
const postItemSchema = z.object({
  content: z.string().optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  description: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  likes: z.number().optional(),
  likeCount: z.number().optional(),
  comments: z.number().optional(),
  commentCount: z.number().optional(),
  engagement: z.number().optional(),
  category: z.string().optional()
}).refine(data => 
  data.content || data.text || data.caption || data.description,
  { message: "Post muss mindestens content, text, caption oder description haben" }
);

export const uploadPostsSchema = z.array(postItemSchema)
  .min(1, "Mindestens 1 Post erforderlich")
  .max(100, "Maximal 100 Posts pro Upload");

// ==============================
// Generation Schemas
// ==============================
export const generatePromptsSchema = z.object({
  category: z.string().max(50).optional().default("general"),
  variantsPerPost: z.number().min(1).max(10).optional().default(3),
  style: z.enum(["viral", "educational", "entertaining", "inspirational", "promotional"]).optional().default("viral"),
  tone: z.enum(["engaging", "professional", "casual", "humorous", "serious"]).optional().default("engaging"),
  language: z.enum(["de", "en"]).optional().default("de")
});

export const generateVideoIdeasSchema = z.object({
  prompts: z.array(z.string().min(10).max(2000))
    .min(1, "Mindestens 1 Prompt erforderlich")
    .max(10, "Maximal 10 Prompts gleichzeitig"),
  detailed: z.boolean().optional().default(true)
});

export const generateHooksSchema = z.object({
  topic: z.string().min(3, "Thema zu kurz").max(500, "Thema zu lang"),
  count: z.number().min(1).max(20).optional().default(10),
  style: z.enum(["question", "statement", "shocking", "story", "mixed"]).optional().default("mixed")
});

export const generateCaptionsSchema = z.object({
  topic: z.string().min(3).max(500),
  tone: z.enum(["casual", "professional", "funny", "inspirational", "educational"]).optional().default("casual"),
  includeEmojis: z.boolean().optional().default(true),
  includeHashtags: z.boolean().optional().default(true),
  count: z.number().min(1).max(10).optional().default(3)
});

export const generateTitleSchema = z.object({
  topic: z.string().min(3).max(500),
  style: z.enum(["clickbait", "informative", "question", "how-to", "listicle"]).optional().default("clickbait"),
  count: z.number().min(1).max(10).optional().default(5)
});

export const trendAnalysisSchema = z.object({
  niche: z.string().min(2).max(100),
  platform: z.enum(["instagram", "tiktok", "youtube", "all"]).optional().default("instagram"),
  timeframe: z.enum(["today", "week", "month"]).optional().default("week")
});

export const viralityAnalysisSchema = z.object({
  content: z.string().min(10).max(5000),
  type: z.enum(["hook", "caption", "script", "full"]).optional().default("full")
});

// ==============================
// Credit Purchase Schema
// ==============================
export const purchaseCreditsSchema = z.object({
  packageId: z.enum(["starter", "pro", "unlimited", "credits_100", "credits_500", "credits_1000"]),
  paymentMethod: z.enum(["stripe", "paypal"]).optional().default("stripe")
});

// ==============================
// Validation Middleware Factory
// ==============================
export function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: 5002,
            message: "Validierungsfehler",
            details: errors
          }
        });
      }
      
      req.validatedBody = result.data;
      next();
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 5002,
          message: "Validierungsfehler",
          details: err.message
        }
      });
    }
  };
}

// Für JSON-Array Bodies (Upload)
export function validateArray(schema) {
  return (req, res, next) => {
    try {
      // Body könnte bereits geparst sein oder als String kommen
      let data = req.body;
      if (typeof data === "string") {
        data = JSON.parse(data);
      }
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: 5002,
            message: "Validierungsfehler",
            details: errors
          }
        });
      }
      
      req.validatedBody = result.data;
      next();
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 5002,
          message: "Ungültiges JSON-Format",
          details: err.message
        }
      });
    }
  };
}

