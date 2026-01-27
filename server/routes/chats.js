const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/ratelimit');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const messageLimiter = rateLimit({ key: 'messages', limit: 30, windowMs: 60_000 });

// Get all user's chats
router.get('/', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        id,
        bot_id,
        messages,
        updated_at,
        created_at,
        bots (
          id,
          share_code,
          roblox_username,
          roblox_avatar_url,
          name,
          description
        )
      `)
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(chats || []);
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ error: 'Failed to get chats' });
  }
});

// Get single chat
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    const { data: chat, error } = await supabase
      .from('chats')
      .select(`
        *,
        bots (
          id,
          share_code,
          roblox_username,
          roblox_avatar_url,
          name,
          system_prompt,
          description
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (err) {
    console.error('Get chat error:', err);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Create a new chat with a bot
router.post('/', requireAuth, async (req, res) => {
  try {
    const { bot_id } = req.body;
    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const supabase = req.app.locals.supabase;

    // Check if bot exists
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, system_prompt, name')
      .eq('id', bot_id)
      .single();

    if (botError || !bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if chat already exists
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('bot_id', bot_id)
      .single();

    if (existingChat) {
      return res.json({ id: existingChat.id, existing: true });
    }

    // Create new chat
    const { data: chat, error } = await supabase
      .from('chats')
      .insert({
        user_id: req.user.id,
        bot_id,
        messages: [],
        conversation: [{ role: 'system', content: bot.system_prompt }],
        notes: []
      })
      .select()
      .single();

    if (error) throw error;

    // Increment bot chat count
    await supabase.rpc('increment_chat_count', { bot_id });

    res.status(201).json(chat);
  } catch (err) {
    console.error('Create chat error:', err);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Send a message in a chat
router.post('/:id/message', requireAuth, messageLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, replyTo } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const supabase = req.app.locals.supabase;

    // Get the chat with bot info
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select(`
        *,
        bots (
          system_prompt,
          name,
          description,
          roblox_username
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message to history
    const userMessage = {
      type: 'sent',
      text,
      timestamp: Date.now(),
      replyTo: replyTo || null
    };

    const messages = [...(chat.messages || []), userMessage];
    const conversation = [...(chat.conversation || [])];

    // Add user message to conversation
    const userContent = replyTo ? `(replying to: ${replyTo})\n${text}` : text;
    conversation.push({ role: 'user', content: userContent });

    // Call OpenAI
    try {
      const completion = await openai.responses.create({
        model: 'gpt-5-nano',
        input: conversation,
        text: { format: { type: 'text' } },
        store: false
      });

      // Extract assistant response
      const assistantContent = completion.output?.find(item => item.type === 'message')?.content?.[0]?.text || '';

      // Add assistant message to history
      const assistantMessage = {
        type: 'received',
        text: assistantContent,
        timestamp: Date.now()
      };

      // Mark the user's latest message as read when assistant responds
      userMessage.readAt = Date.now();

      messages.push(assistantMessage);
      conversation.push({ role: 'assistant', content: assistantContent });

      // Update chat in database
      const { error: updateError } = await supabase
        .from('chats')
        .update({
          messages,
          conversation,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      res.json({
        userMessage,
        assistantMessage,
        raw: assistantContent
      });
    } catch (aiError) {
      console.error('OpenAI error:', aiError);
      res.status(500).json({ error: 'Failed to get AI response' });
    }
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Update chat notes
router.patch('/:id/notes', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = req.app.locals.supabase;

    const { data: chat, error } = await supabase
      .from('chats')
      .update({ notes })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(chat);
  } catch (err) {
    console.error('Update notes error:', err);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

// Delete a chat
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.app.locals.supabase;

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete chat error:', err);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

module.exports = router;
