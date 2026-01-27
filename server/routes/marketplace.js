const express = require('express');
const router = express.Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');

function parseCsv(value) {
  return (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function uniq(list) {
  return Array.from(new Set(list));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dailySeed() {
  const d = new Date();
  const key = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  return seed >>> 0;
}

// Get all approved bots for marketplace
router.get('/', optionalAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const sort = (req.query.sort || 'popular').toString();
    const orderBy = sort === 'new' ? { column: 'created_at', ascending: false } : { column: 'chat_count', ascending: false };

    const featuredCodes = uniq(parseCsv(process.env.FEATURED_BOT_CODES).map(c => c.toUpperCase()));
    const featuredIds = uniq(parseCsv(process.env.FEATURED_BOT_IDS));

    let featuredBots = [];
    if (featuredCodes.length > 0 || featuredIds.length > 0) {
      let featuredQuery = supabase
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
        .eq('is_public', true);

      if (featuredIds.length > 0) {
        featuredQuery = featuredQuery.in('id', featuredIds);
      } else {
        featuredQuery = featuredQuery.in('share_code', featuredCodes);
      }

      const { data: featured, error: featuredError } = await featuredQuery.limit(20);
      if (!featuredError && featured) {
        featuredBots = featured;
      }
    }

    const featuredIdSet = new Set(featuredBots.map(b => b.id));

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
      .order(orderBy.column, { ascending: orderBy.ascending })
      .limit(50);

    if (error) throw error;
    let featuredFinal = featuredBots;
    let mainBots = (bots || []).filter(b => !featuredIdSet.has(b.id));

    // If nothing is explicitly featured, pick a daily-rotating set from the results.
    if (featuredFinal.length === 0) {
      const rng = mulberry32(dailySeed());
      const candidates = [...mainBots];
      const pickCount = Math.min(5, candidates.length);
      featuredFinal = [];

      for (let i = 0; i < pickCount; i++) {
        const idx = Math.floor(rng() * candidates.length);
        const [picked] = candidates.splice(idx, 1);
        if (picked) featuredFinal.push(picked);
      }

      const pickedSet = new Set(featuredFinal.map(b => b.id));
      mainBots = mainBots.filter(b => !pickedSet.has(b.id));
    }

    res.json({
      sort,
      featured: featuredFinal,
      bots: mainBots
    });
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
