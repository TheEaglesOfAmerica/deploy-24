const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Get all approved bots for marketplace
router.get('/', optionalAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const { data: bots, error } = await supabase
      .from('bots')
      .select(`
        id,
        share_code,
        roblox_user_id,
        roblox_username,
        roblox_avatar_url,
        name,
        description,
        chat_count,
        created_at,
        profiles:creator_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('approved', true)
      .eq('is_public', true)
      .order('chat_count', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ bots: bots || [] });
  } catch (err) {
    console.error('Get marketplace error:', err);
    res.status(500).json({ error: 'Failed to get marketplace bots' });
  }
});

// Search marketplace bots
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const supabase = req.app.locals.supabase;

    const { data: bots, error } = await supabase
      .from('bots')
      .select(`
        id,
        share_code,
        roblox_user_id,
        roblox_username,
        roblox_avatar_url,
        name,
        description,
        chat_count,
        profiles:creator_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .eq('approved', true)
      .eq('is_public', true)
      .or(`name.ilike.%${q}%,roblox_username.ilike.%${q}%,description.ilike.%${q}%`)
      .order('chat_count', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ bots: bots || [] });
  } catch (err) {
    console.error('Search marketplace error:', err);
    res.status(500).json({ error: 'Failed to search marketplace' });
  }
});

module.exports = router;
