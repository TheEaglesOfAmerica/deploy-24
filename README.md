# iMessage Chat - Cloudflare Pages Deployment

An authentic iMessage-style chat interface powered by OpenAI's GPT models.

## Features
- Authentic iMessage UI
- Reactions, replies, search, image support
- Link previews with thumbnails
- Real-time typing indicators
- Delivered/Read receipts

## Deployment to Cloudflare Pages

### 1. Push to GitHub
```bash
cd imessage-chat
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Cloudflare Pages
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
5. Click **Save and Deploy**

### 3. Set Environment Variable
1. In your Pages project, go to **Settings** → **Environment variables**
2. Add a new variable:
   - **Variable name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (starts with `sk-proj-...`)
   - **Environment:** Production (and Preview if needed)
3. Click **Save**
4. Redeploy your project for changes to take effect

## Local Development

Since this uses Cloudflare Pages Functions, you'll need Wrangler for local development:

```bash
npm install -g wrangler
```

Create a `.dev.vars` file for local environment variables:
```
OPENAI_API_KEY=your-api-key-here
```

Run locally:
```bash
wrangler pages dev .
```

The app will be available at `http://localhost:8788`

## Project Structure
```
imessage-chat/
├── index.html              # Main HTML file
├── styles.css             # All CSS styles
├── app.js                 # Client-side JavaScript
├── functions/
│   └── api/
│       └── chat.js        # Cloudflare Function (API proxy)
├── _headers               # HTTP headers configuration
└── README.md              # This file
```

## How It Works

The app uses a Cloudflare Pages Function (`/api/chat`) to proxy requests to OpenAI's API. This keeps your API key secure on the server side, preventing exposure in the browser.

- **Client** → Sends message to `/api/chat`
- **Cloudflare Function** → Forwards to OpenAI with API key from environment
- **OpenAI** → Returns response
- **Client** → Displays AI response in chat

## Security

✅ API key stored as environment variable (never in code)  
✅ Requests proxied through serverless function  
✅ No API key exposure in browser
