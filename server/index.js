require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Make supabase available to routes
app.locals.supabase = supabase;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bots', require('./routes/bots'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/moderation', require('./routes/moderation'));
app.use('/api', require('./routes/utils'));

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isCrawlerUserAgent(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  return /(facebookexternalhit|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|embedly|quora link preview|googlebot|bingbot|duckduckbot|yandex|baiduspider|pinterest|applebot|ia_archiver)/i.test(ua);
}

// Share links with rich embeds (OG/Twitter)
// Nginx should proxy /b/* here for this to work.
app.get('/b/:code', async (req, res) => {
  try {
    const rawCode = (req.params.code || '').toString();
    const code = rawCode.replace(/[^a-z0-9]/gi, '').toUpperCase();

    if (!/^[A-Z0-9]{4}$/.test(code)) {
      return res.status(400).send('Invalid code');
    }

    const { data: bot } = await supabase
      .from('bots')
      .select('share_code, name, description, roblox_username, roblox_avatar_url, chat_count')
      .eq('share_code', code)
      .single();

    if (!bot) {
      return res.status(404).send('Bot not found');
    }

    const title = `${bot.name || bot.roblox_username || 'Bot'} on Spunnie`;
    const desc = bot.description || `Chat with @${bot.roblox_username || 'bot'} on Spunnie.`;
    const image = bot.roblox_avatar_url || 'https://via.placeholder.com/300';

    // Redirect humans into the SPA, but give crawlers OG tags.
    const appUrl = `/?b=${encodeURIComponent(code)}`;

    // Most browsers should go straight to the SPA (no "HTML page" flash).
    // Crawlers need the OG/Twitter meta, so we serve the HTML only for them.
    if (!isCrawlerUserAgent(req.get('user-agent'))) {
      return res.redirect(302, appUrl);
    }

    res.set('Content-Type', 'text/html; charset=utf-8');

    const proto = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim() || 'https';
    const url = `${proto}://${req.get('host')}/b/${code}`;

    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />
</head>
<body>
  <p>Redirecting…</p>
  <script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`);
  } catch (err) {
    console.error('Share link error:', err);
    res.status(500).send('Failed to render share page');
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
