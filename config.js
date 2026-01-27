// Chat Bots Configuration
// Update these values for your deployment

const CONFIG = {
  // Supabase (self-hosted)
  SUPABASE_URL: 'http://localhost:8000', // Change to your Supabase URL
  SUPABASE_ANON_KEY: 'your-anon-key-here', // Change to your anon key

  // Backend API
  API_URL: 'http://localhost:3000/api', // Change to your API URL

  // App info
  APP_NAME: 'Chat Bots',
  APP_URL: 'http://localhost:5500', // Change to your frontend URL

  // Support bot
  SUPPORT_BOT_CODE: 'HELP'
};

// Make config available globally
window.CONFIG = CONFIG;
