const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Fetch Roblox user info by ID
router.get('/roblox/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user info
    const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!userResponse.ok) {
      return res.status(404).json({ error: 'Roblox user not found' });
    }
    const userData = await userResponse.json();

    // Fetch avatar headshot
    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    );
    const avatarData = await avatarResponse.json();
    const avatarUrl = avatarData.data?.[0]?.imageUrl || null;

    res.json({
      id: userData.id,
      username: userData.name,
      displayName: userData.displayName,
      description: userData.description,
      created: userData.created,
      avatarUrl
    });
  } catch (err) {
    console.error('Roblox API error:', err);
    res.status(500).json({ error: 'Failed to fetch Roblox user' });
  }
});

// Search Roblox users by username
router.get('/roblox/search/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: true
      })
    });

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = data.data[0];

    // Fetch avatar
    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`
    );
    const avatarData = await avatarResponse.json();
    const avatarUrl = avatarData.data?.[0]?.imageUrl || null;

    res.json({
      id: user.id,
      username: user.name,
      displayName: user.displayName,
      avatarUrl
    });
  } catch (err) {
    console.error('Roblox search error:', err);
    res.status(500).json({ error: 'Failed to search Roblox user' });
  }
});

// Generate system prompt from description
router.post('/generate-prompt', requireAuth, async (req, res) => {
  try {
    const { description, robloxUsername, robloxDisplayName } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const prompt = `You are a prompt engineer. Create a detailed system prompt for an AI chatbot based on this description.

The bot is based on a Roblox user:
- Username: ${robloxUsername || 'unknown'}
- Display Name: ${robloxDisplayName || robloxUsername || 'unknown'}

User's description of the bot's personality:
"${description}"

Create a system prompt that:
1. Defines the bot's personality, speaking style, and mannerisms
2. Sets appropriate boundaries (keep it friendly, no inappropriate content)
3. Makes the bot feel authentic and consistent
4. Includes specific phrases or reactions the bot might use
5. Keeps responses concise (under 150 characters typically, like texting)
6. Uses casual internet/texting language (lowercase, abbreviations, etc)

Output ONLY the system prompt text, nothing else. Make it detailed but focused.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.8
    });

    const systemPrompt = completion.choices[0]?.message?.content || '';

    res.json({ systemPrompt });
  } catch (err) {
    console.error('Generate prompt error:', err);
    res.status(500).json({ error: 'Failed to generate prompt' });
  }
});

// Support bot system prompt
const SUPPORT_BOT_PROMPT = `You are the Support Bot - a helpful guide for users of the Chat Bots platform.

Your personality:
- Friendly and helpful, like a knowledgeable friend
- Clear and concise explanations
- Patient with new users
- Use casual language but stay professional

What you help with:
1. How to create a bot (enter Roblox user ID, write description, get share code)
2. How share codes work (4-digit codes like "7X3K" to share bots with friends)
3. How share links work (chatbots.app/b/CODE format)
4. How to find bots (enter someone's share code)
5. General app questions

Key features to explain:
- Bots are based on real Roblox users (their avatar is used)
- Descriptions get turned into AI personalities
- Each bot has a unique 4-digit share code
- Users can create unlimited bots
- Chats are saved to your account
- Themes can be customized

Keep responses short and helpful. Use bullet points for lists.
If asked about something unrelated to the app, politely redirect to app-related help.`;

// Get support bot info (for creating support chat)
router.get('/support-bot', async (req, res) => {
  res.json({
    id: 'support',
    share_code: 'HELP',
    name: 'Support',
    roblox_username: 'Support',
    roblox_avatar_url: null, // Will use a default support icon
    system_prompt: SUPPORT_BOT_PROMPT,
    is_system: true
  });
});

module.exports = router;
