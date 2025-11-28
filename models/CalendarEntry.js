"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _mongoose = _interopRequireDefault(require("mongoose"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// ==============================
// Calendar Entry Schema
// ==============================
const calendarEntrySchema = new _mongoose.default.Schema({
  userId: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  organization: {
    type: _mongoose.default.Schema.Types.ObjectId,
    ref: "Organization",
    default: null
  },
  // Content
  title: {
    type: String,
    required: true,
    maxLength: 200
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ["prompt", "hook", "caption", "script", "idea", "custom"],
    default: "custom"
  },
  // Platform
  platform: {
    type: String,
    enum: ["instagram", "tiktok", "youtube", "twitter", "linkedin", "all"],
    default: "instagram"
  },
  // Scheduling
  scheduledFor: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    // "14:30"
    default: "12:00"
  },
  timezone: {
    type: String,
    default: "Europe/Berlin"
  },
  // Status
  status: {
    type: String,
    enum: ["draft", "scheduled", "published", "failed", "cancelled"],
    default: "draft"
  },
  publishedAt: Date,
  failureReason: String,
  // AI Generated Metadata
  aiGenerated: {
    type: Boolean,
    default: false
  },
  sourcePrompt: String,
  viralityScore: Number,
  // Attachments
  attachments: [{
    type: {
      type: String,
      enum: ["image", "video", "audio"]
    },
    url: String,
    thumbnail: String
  }],
  // Hashtags & Mentions
  hashtags: [String],
  mentions: [String],
  // Notes
  notes: String,
  // Analytics (after publishing)
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    }
  },
  // Color for calendar display
  color: {
    type: String,
    default: "#8b5cf6"
  },
  // Recurring
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ["daily", "weekly", "monthly", null],
    default: null
  },
  recurringEndDate: Date
}, {
  timestamps: true
});

// Indexes
calendarEntrySchema.index({
  userId: 1,
  scheduledFor: 1
});
calendarEntrySchema.index({
  organization: 1,
  scheduledFor: 1
});
calendarEntrySchema.index({
  status: 1,
  scheduledFor: 1
});

// Methods
calendarEntrySchema.methods.markPublished = async function () {
  this.status = "published";
  this.publishedAt = new Date();
  await this.save();
};
calendarEntrySchema.methods.markFailed = async function (reason) {
  this.status = "failed";
  this.failureReason = reason;
  await this.save();
};

// Statics
calendarEntrySchema.statics.getByDateRange = async function (userId, startDate, endDate, orgId = null) {
  const query = {
    scheduledFor: {
      $gte: startDate,
      $lte: endDate
    }
  };
  if (orgId) {
    query.organization = orgId;
  } else {
    query.userId = userId;
  }
  return this.find(query).sort({
    scheduledFor: 1
  });
};
calendarEntrySchema.statics.getUpcoming = async function (userId, limit = 10) {
  return this.find({
    userId,
    scheduledFor: {
      $gte: new Date()
    },
    status: {
      $in: ["draft", "scheduled"]
    }
  }).sort({
    scheduledFor: 1
  }).limit(limit);
};
calendarEntrySchema.statics.getStats = async function (userId, month, year) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const stats = await this.aggregate([{
    $match: {
      userId: new _mongoose.default.Types.ObjectId(userId),
      scheduledFor: {
        $gte: startDate,
        $lte: endDate
      }
    }
  }, {
    $group: {
      _id: "$status",
      count: {
        $sum: 1
      }
    }
  }]);
  const byPlatform = await this.aggregate([{
    $match: {
      userId: new _mongoose.default.Types.ObjectId(userId),
      scheduledFor: {
        $gte: startDate,
        $lte: endDate
      }
    }
  }, {
    $group: {
      _id: "$platform",
      count: {
        $sum: 1
      }
    }
  }]);
  return {
    byStatus: stats,
    byPlatform
  };
};
var _default = exports.default = _mongoose.default.model("CalendarEntry", calendarEntrySchema);