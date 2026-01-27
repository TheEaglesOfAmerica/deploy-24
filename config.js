// Spunnie Configuration
// Update these values for your deployment

const CONFIG = {
  // Supabase (self-hosted)
  SUPABASE_URL: 'http://localhost:8000', // Change to your Supabase URL
  SUPABASE_ANON_KEY: 'your-anon-key-here', // Change to your anon key

  // Backend API
  API_URL: 'http://localhost:3000/api', // Change to your API URL

  // App info
  APP_NAME: 'Spunnie',
  APP_URL: 'http://localhost:5500', // Change to your frontend URL (e.g., https://spunnie.com)

  // Support bot
  SUPPORT_BOT_CODE: 'HELP'
};

// Make config available globally
window.CONFIG = CONFIG;
