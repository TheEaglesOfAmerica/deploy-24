const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/ratelimit');

const createBotLimiter = rateLimit({ key: 'createBot', limit: 6, windowMs: 60_000 });
const updateBotLimiter = rateLimit({ key: 'updateBot', limit: 20, windowMs: 60_000 });

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

// Marketplace: list public bots
router.get('/marketplace', optionalAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const { data: bots, error } = await supabase
      .from('bots')
      .select('id, share_code, roblox_user_id, roblox_username, roblox_avatar_url, name, description, chat_count, created_at, is_public')
      .eq('is_public', true)
      .order('chat_count', { ascending: false })
      .limit(60);

    if (error) throw error;
    res.json(bots || []);
  } catch (err) {
    console.error('Marketplace bots error:', err);
    res.status(500).json({ error: 'Failed to load marketplace bots' });
  }
});

// Get bot by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    const { data: bot, error } = await supabase
      .from('bots')
      .select('id, share_code, roblox_user_id, roblox_username, roblox_avatar_url, name, description, system_prompt, chat_count, created_at, creator_id')
      .eq('id', id)
      .single();

    if (error || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Only include system_prompt if user is the creator
    if (req.user?.id !== bot.creator_id) {
      delete bot.system_prompt;
    }

    res.json(bot);
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
    res.json(bots || []);
  } catch (err) {
    console.error('Get user bots error:', err);
    res.status(500).json({ error: 'Failed to get bots' });
  }
});

// Create a new bot
router.post('/', requireAuth, createBotLimiter, async (req, res) => {
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
        is_public: !!is_public
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
router.patch('/:id', requireAuth, updateBotLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, system_prompt, is_public } = req.body;
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
