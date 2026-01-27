const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Middleware to check if user is admin
async function requireAdmin(req, res, next) {
  try {
    // Check if user has admin role in user_metadata
    if (!req.user?.user_metadata?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Get pending bots for moderation
router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const { data: bots, error } = await supabase
      .from('bots')
      .select(`
        *,
        profiles:creator_id (
          id,
          display_name,
          avatar_url
        )
      `)
      .is('approved', null)
      .is('rejected', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ bots: bots || [] });
  } catch (err) {
    console.error('Get pending bots error:', err);
    res.status(500).json({ error: 'Failed to get pending bots' });
  }
});

// Approve a bot
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    const { data: bot, error } = await supabase
      .from('bots')
      .update({
        approved: true,
        rejected: false,
        is_public: true,
        moderated_at: new Date().toISOString(),
        moderated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ bot, message: 'Bot approved successfully' });
  } catch (err) {
    console.error('Approve bot error:', err);
    res.status(500).json({ error: 'Failed to approve bot' });
  }
});

// Reject a bot
router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const supabase = req.app.locals.supabase;

    const { data: bot, error } = await supabase
      .from('bots')
      .update({
        approved: false,
        rejected: true,
        rejection_reason: reason || 'Does not meet guidelines',
        is_public: false,
        moderated_at: new Date().toISOString(),
        moderated_by: req.user.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ bot, message: 'Bot rejected' });
  } catch (err) {
    console.error('Reject bot error:', err);
    res.status(500).json({ error: 'Failed to reject bot' });
  }
});

// Get moderation stats
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
      supabase.from('bots').select('id', { count: 'exact' }).is('approved', null).is('rejected', null),
      supabase.from('bots').select('id', { count: 'exact' }).eq('approved', true),
      supabase.from('bots').select('id', { count: 'exact' }).eq('rejected', true)
    ]);

    res.json({
      pending: pendingResult.count || 0,
      approved: approvedResult.count || 0,
      rejected: rejectedResult.count || 0
    });
  } catch (err) {
    console.error('Get moderation stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
