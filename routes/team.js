import express from "express";
import auth from "../middleware/auth.js";
import { createSuccessResponse, createErrorResponse } from "../utils/errorHandler.js";
import { logger } from "../utils/logger.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";

const router = express.Router();

// ==============================
// Get Current Organization
// ==============================
router.get("/", auth, async (req, res) => {
  try {
    const org = await Organization.findByMember(req.user.id);
    
    if (!org) {
      return res.json(createSuccessResponse({ organization: null }));
    }
    
    return res.json(createSuccessResponse({ organization: org }));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Create Organization
// ==============================
router.post("/", auth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.length < 2) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Team-Name erforderlich (min. 2 Zeichen)"));
    }
    
    // Check if user already has an organization
    const existingOrg = await Organization.findByMember(req.user.id);
    if (existingOrg) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Du bist bereits in einem Team"));
    }
    
    const org = await Organization.create({
      name,
      owner: req.user.id
    });
    
    // Update user
    await User.findByIdAndUpdate(req.user.id, {
      organization: org._id,
      organizationRole: "owner"
    });
    
    logger.info(`Organization created: ${org.name} by ${req.user.email}`);
    
    return res.status(201).json(createSuccessResponse({ organization: org }, "Team erfolgreich erstellt"));
  } catch (err) {
    logger.error("Create organization error", { error: err.message });
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Update Organization
// ==============================
router.put("/", auth, async (req, res) => {
  try {
    const org = await Organization.findOne({ owner: req.user.id });
    
    if (!org) {
      return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Nur der Team-Owner kann das Team bearbeiten"));
    }
    
    const { name, sharedStyle, brandKit } = req.body;
    
    if (name) org.name = name;
    if (sharedStyle) org.sharedStyle = { ...org.sharedStyle, ...sharedStyle };
    if (brandKit) org.brandKit = { ...org.brandKit, ...brandKit };
    
    await org.save();
    
    return res.json(createSuccessResponse({ organization: org }, "Team aktualisiert"));
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Invite Member
// ==============================
router.post("/invite", auth, async (req, res) => {
  try {
    const { email, role = "member" } = req.body;
    
    if (!email) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "E-Mail erforderlich"));
    }
    
    const org = await Organization.findOne({
      $or: [
        { owner: req.user.id },
        { "members.user": req.user.id, "members.role": "admin" }
      ]
    });
    
    if (!org) {
      return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Keine Berechtigung zum Einladen"));
    }
    
    // Check member limit
    if (org.members.length >= org.maxMembers) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", `Maximale Teamgröße (${org.maxMembers}) erreicht`));
    }
    
    // Check if already invited
    const existingInvite = org.invites.find(i => i.email === email.toLowerCase());
    if (existingInvite) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Diese E-Mail wurde bereits eingeladen"));
    }
    
    // Check if user exists and is already in team
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const isMember = org.members.find(m => m.user.toString() === existingUser._id.toString());
      if (isMember || org.owner.toString() === existingUser._id.toString()) {
        return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "User ist bereits Mitglied"));
      }
    }
    
    const token = await org.createInvite(email.toLowerCase(), role, req.user.id);
    
    // In production: Send email with invite link
    // For now, just return the token
    const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/team/join?token=${token}`;
    
    logger.info(`Team invite sent to ${email} for org ${org.name}`);
    
    return res.json(createSuccessResponse({
      inviteLink,
      expiresIn: "7 Tage"
    }, `Einladung an ${email} gesendet`));
    
  } catch (err) {
    logger.error("Invite error", { error: err.message });
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Accept Invite
// ==============================
router.post("/join", auth, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Einladungs-Token erforderlich"));
    }
    
    // Find organization with this invite
    const org = await Organization.findOne({
      "invites.token": token,
      "invites.expiresAt": { $gt: new Date() }
    });
    
    if (!org) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Ungültige oder abgelaufene Einladung"));
    }
    
    const invite = org.invites.find(i => i.token === token);
    
    // Check if user email matches invite
    const user = await User.findById(req.user.id);
    if (user.email !== invite.email) {
      return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Diese Einladung ist für eine andere E-Mail-Adresse"));
    }
    
    // Add member
    await org.addMember(req.user.id, invite.role, invite.invitedBy);
    
    // Remove invite
    org.invites = org.invites.filter(i => i.token !== token);
    await org.save();
    
    logger.info(`${user.email} joined organization ${org.name}`);
    
    return res.json(createSuccessResponse({ organization: org }, `Willkommen im Team ${org.name}!`));
    
  } catch (err) {
    logger.error("Join error", { error: err.message });
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Remove Member
// ==============================
router.delete("/members/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const org = await Organization.findOne({ owner: req.user.id });
    
    if (!org) {
      return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Nur der Team-Owner kann Mitglieder entfernen"));
    }
    
    if (userId === req.user.id) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Du kannst dich nicht selbst entfernen"));
    }
    
    await org.removeMember(userId);
    
    logger.info(`Member ${userId} removed from org ${org.name}`);
    
    return res.json(createSuccessResponse(null, "Mitglied entfernt"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Leave Organization
// ==============================
router.post("/leave", auth, async (req, res) => {
  try {
    const org = await Organization.findByMember(req.user.id);
    
    if (!org) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Du bist in keinem Team"));
    }
    
    if (org.owner.toString() === req.user.id) {
      return res.status(400).json(createErrorResponse("VALIDATION_ERROR", "Als Owner kannst du das Team nicht verlassen. Übertrage zuerst die Ownership oder lösche das Team."));
    }
    
    await org.removeMember(req.user.id);
    
    return res.json(createSuccessResponse(null, "Team verlassen"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

// ==============================
// Delete Organization
// ==============================
router.delete("/", auth, async (req, res) => {
  try {
    const org = await Organization.findOne({ owner: req.user.id });
    
    if (!org) {
      return res.status(403).json(createErrorResponse("AUTH_TOKEN_INVALID", "Nur der Team-Owner kann das Team löschen"));
    }
    
    // Remove organization reference from all members
    for (const member of org.members) {
      await User.findByIdAndUpdate(member.user, {
        organization: null,
        organizationRole: null
      });
    }
    
    // Remove from owner
    await User.findByIdAndUpdate(req.user.id, {
      organization: null,
      organizationRole: null
    });
    
    await org.deleteOne();
    
    logger.info(`Organization ${org.name} deleted`);
    
    return res.json(createSuccessResponse(null, "Team gelöscht"));
    
  } catch (err) {
    return res.status(500).json(createErrorResponse("DATABASE_ERROR", err.message));
  }
});

export default router;


