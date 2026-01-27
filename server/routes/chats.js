const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
          name
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
          system_prompt
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

    // Create new chat (conversation will be initialized on first message)
    const { data: chat, error } = await supabase
      .from('chats')
      .insert({
        user_id: req.user.id,
        bot_id,
        messages: [],
        conversation: [],
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

// Base system prompt for all bots (server-controlled)
const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant designed to chat naturally like a friend.

Core Guidelines:
- Keep responses concise (under 150 characters typically, like texting)
- Use casual internet/texting language (lowercase, abbreviations, etc.)
- Be friendly and engaging
- Stay in character based on your personality description
- Keep it appropriate for general audiences

Tools Available:
You have access to a weather tool. When the user asks about weather, temperature, or forecast:
- Respond with: [TOOL:weather city=CITY_NAME]
- If no city is provided, ask for one first
- After using the tool, incorporate the weather data naturally into your response

Remember to stay true to your personality while being helpful!`;

// Tool definitions for OpenAI
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a specific city',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The city name to get weather for, e.g. "San Francisco"'
          }
        },
        required: ['city']
      }
    }
  }
];

// Send a message in a chat
router.post('/:id/message', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

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
          name
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Combine base prompt with bot's custom prompt
    const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}

Personality Description:
${chat.bots.system_prompt || 'Be helpful and friendly.'}`;

    // Add user message to history
    const userMessage = {
      type: 'sent',
      text,
      timestamp: Date.now()
    };

    const messages = [...(chat.messages || []), userMessage];
    let conversation = [...(chat.conversation || [])];

    // Update system prompt if it's the first message or if it changed
    if (conversation.length === 0 || conversation[0].role !== 'system') {
      conversation = [{ role: 'system', content: fullSystemPrompt }, ...conversation];
    } else {
      conversation[0].content = fullSystemPrompt;
    }

    // Add user message to conversation
    conversation.push({ role: 'user', content: text });

    // Call OpenAI with tools
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.8,
        max_tokens: 300
      });

      const responseMessage = completion.choices[0].message;
      let assistantContent = responseMessage.content || '';

      // Handle tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolCall = responseMessage.tool_calls[0];

        // Add assistant's tool call to conversation
        conversation.push(responseMessage);

        if (toolCall.function.name === 'get_weather') {
          const args = JSON.parse(toolCall.function.arguments);
          const city = args.city;

          // Simulate weather data (in production, call a real weather API)
          const weatherData = {
            city: city,
            temperature: Math.floor(Math.random() * 30) + 50,
            condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 40) + 40
          };

          const toolResponse = {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(weatherData)
          };

          conversation.push(toolResponse);

          // Get final response with weather data
          const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: conversation,
            temperature: 0.8,
            max_tokens: 300
          });

          assistantContent = finalCompletion.choices[0].message.content || '';
          conversation.push({ role: 'assistant', content: assistantContent });
        }
      } else {
        conversation.push({ role: 'assistant', content: assistantContent });
      }

      // Add assistant message to history
      const assistantMessage = {
        type: 'received',
        text: assistantContent,
        timestamp: Date.now()
      };

      // Mark the user's latest message as read when assistant responds
      userMessage.readAt = Date.now();

      messages.push(assistantMessage);

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
