const express = require('express');
const OpenAI = require('openai');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function moderateBotContent({ name, description, systemPrompt }) {
  const input = `${name || ''}\n${description || ''}\n${systemPrompt || ''}`.trim();

  if (!process.env.OPENAI_API_KEY) {
    return {
      approved: null,
      rejected: null,
      rejectionReason: 'Moderation unavailable (missing API key)'
    };
  }

  try {
    const response = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input
    });

    const result = response?.results?.[0];
    if (!result) {
      throw new Error('No moderation result');
    }

    const flagged = result.flagged === true;
    const categories = result.categories || {};
    const flaggedCategories = Object.entries(categories)
      .filter(([, value]) => value === true)
      .map(([key]) => key);

    if (flagged) {
      return {
        approved: false,
        rejected: true,
        rejectionReason: flaggedCategories.length
          ? `Flagged: ${flaggedCategories.join(', ')}`
          : 'Flagged by moderation'
      };
    }

    return {
      approved: true,
      rejected: false,
      rejectionReason: null
    };
  } catch (err) {
    console.error('Moderation API error:', err?.message || err);
    return {
      approved: null,
      rejected: null,
      rejectionReason: 'Moderation unavailable — retrying'
    };
  }
}

function buildModerationStatus(bot) {
  if (bot.approved === true) {
    return {
      status: 'approved',
      message: 'Approved',
      is_stuck: false,
      pending_age_minutes: null
    };
  }

  if (bot.rejected === true) {
    return {
      status: 'rejected',
      message: bot.rejection_reason ? `Rejected — ${bot.rejection_reason}` : 'Rejected',
      is_stuck: false,
      pending_age_minutes: null
    };
  }

  const createdAtMs = bot.created_at ? new Date(bot.created_at).getTime() : null;
  const ageMinutes = createdAtMs ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 60000)) : null;
  const stuckThresholdMinutes = 30;
  const isStuck = ageMinutes !== null && ageMinutes >= stuckThresholdMinutes;

  let message = bot.rejection_reason ? `Pending — ${bot.rejection_reason}` : 'Pending — queued';
  if (ageMinutes !== null) {
    message = isStuck
      ? `Pending — stuck (${ageMinutes}m). ${bot.rejection_reason || 'Try editing description or contact support.'}`
      : (bot.rejection_reason ? `Pending — ${bot.rejection_reason}` : `Pending — queued (${ageMinutes}m ago)`);
  }

  return {
    status: 'pending',
    message,
    is_stuck: isStuck,
    pending_age_minutes: ageMinutes
  };
}

// Generate a unique 4-character code
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get bot by share code (public)
router.get('/code/:code', optionalAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const supabase = req.app.locals.supabase;

    const { data: bot, error } = await supabase
      .from('bots')
      .select('id, share_code, roblox_user_id, roblox_username, roblox_avatar_url, name, description, chat_count, created_at')
      .eq('share_code', code.toUpperCase())
      .single();

    if (error || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json(bot);
  } catch (err) {
    console.error('Get bot by code error:', err);
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

// Get bot by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    const { data: bot, error } = await supabase
      .from('bots')
      .select('id, share_code, roblox_user_id, roblox_username, roblox_avatar_url, name, description, system_prompt, chat_count, created_at, creator_id, is_public, approved, rejected, rejection_reason, moderated_at')
      .eq('id', id)
      .single();

    if (error || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Only include system_prompt if user is the creator
    if (req.user?.id !== bot.creator_id) {
      delete bot.system_prompt;
    }

    const moderationStatus = buildModerationStatus(bot);
    res.json({
      ...bot,
      moderation_status: moderationStatus.status,
      moderation_message: moderationStatus.message,
      moderation_is_stuck: moderationStatus.is_stuck,
      moderation_age_minutes: moderationStatus.pending_age_minutes
    });
  } catch (err) {
    console.error('Get bot error:', err);
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

// Get user's created bots
router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const { data: bots, error } = await supabase
      .from('bots')
      .select('*')
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    let botsData = bots || [];

    const pendingBots = botsData.filter(bot => bot.approved === null && bot.rejected === null);
    if (pendingBots.length > 0) {
      await Promise.all(pendingBots.map(async (bot) => {
        const moderation = await moderateBotContent({
          name: bot.name,
          description: bot.description,
          systemPrompt: bot.system_prompt
        });
        const approved = moderation.approved === true ? true : (moderation.rejected === true ? false : null);
        const rejected = moderation.rejected === true ? true : (moderation.approved === true ? false : null);
        const { error: updateError } = await supabase
          .from('bots')
          .update({
            approved,
            rejected,
            rejection_reason: moderation.rejectionReason || null,
            is_public: approved === true ? !!bot.is_public : false,
            moderated_at: new Date().toISOString()
          })
          .eq('id', bot.id);
        if (updateError) {
          console.error('Auto-moderation update failed for bot:', bot.id, updateError);
        }
      }));

      const { data: refreshed } = await supabase
        .from('bots')
        .select('*')
        .eq('creator_id', req.user.id)
        .order('created_at', { ascending: false });
      botsData = refreshed || botsData;
    }

    const enriched = (botsData || []).map(bot => {
      const moderationStatus = buildModerationStatus(bot);
      return {
        ...bot,
        moderation_status: moderationStatus.status,
        moderation_message: moderationStatus.message,
        moderation_is_stuck: moderationStatus.is_stuck,
        moderation_age_minutes: moderationStatus.pending_age_minutes
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Get user bots error:', err);
    res.status(500).json({ error: 'Failed to get bots' });
  }
});

// Create a new bot
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      roblox_user_id,
      roblox_username,
      roblox_avatar_url,
      name,
      description,
      system_prompt,
      is_public
    } = req.body;

    if (!roblox_user_id || !name || !system_prompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = req.app.locals.supabase;

    // Generate unique share code
    let shareCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      shareCode = generateShareCode();
      const { data: existing } = await supabase
        .from('bots')
        .select('id')
        .eq('share_code', shareCode)
        .single();

      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique code' });
    }

    const moderation = await moderateBotContent({
      name,
      description,
      systemPrompt: system_prompt
    });
    const approved = moderation.approved === true ? true : (moderation.rejected === true ? false : null);
    const rejected = moderation.rejected === true ? true : (moderation.approved === true ? false : null);

    // Create the bot
    const { data: bot, error } = await supabase
      .from('bots')
      .insert({
        creator_id: req.user.id,
        share_code: shareCode,
        roblox_user_id,
        roblox_username,
        roblox_avatar_url,
        name,
        description,
        system_prompt,
        is_public: approved === true ? !!is_public : false,
        approved,
        rejected,
        rejection_reason: moderation.rejectionReason || null,
        moderated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(bot);
  } catch (err) {
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Update a bot
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, system_prompt, is_public } = req.body;
    const supabase = req.app.locals.supabase;

    // Check ownership
    const { data: existing } = await supabase
      .from('bots')
      .select('creator_id, approved, rejected')
      .eq('id', id)
      .single();

    if (!existing || existing.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (is_public === true && existing.approved !== true) {
      return res.status(400).json({ error: 'Bot must be approved before it can be public' });
    }

    const updatePayload = {
      updated_at: new Date().toISOString()
    };
    if (typeof name === 'string') updatePayload.name = name;
    if (typeof description === 'string') updatePayload.description = description;
    if (typeof system_prompt === 'string') updatePayload.system_prompt = system_prompt;
    if (typeof is_public === 'boolean') updatePayload.is_public = is_public;

    const { data: bot, error } = await supabase
      .from('bots')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(bot);
  } catch (err) {
    console.error('Update bot error:', err);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Delete a bot
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    // Check ownership
    const { data: existing } = await supabase
      .from('bots')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (!existing || existing.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete associated chats first
    await supabase
      .from('chats')
      .delete()
      .eq('bot_id', id);

    // Delete the bot
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete bot error:', err);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

module.exports = router;
