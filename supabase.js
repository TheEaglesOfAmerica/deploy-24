// Chat Bots Supabase Client
// Handles authentication and database operations

class ChatBotsClient {
  constructor() {
    this.supabase = null;
    this.user = null;
    this.session = null;
    this.onAuthChange = null;
  }

  // Initialize Supabase client
  async init() {
    // Load Supabase from CDN if not already loaded
    if (!window.supabase) {
      await this.loadSupabaseScript();
    }

    this.supabase = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );

    // Set up auth state listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.session = session;
      this.user = session?.user || null;

      if (this.onAuthChange) {
        this.onAuthChange(event, session);
      }
    });

    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession();
    this.session = session;
    this.user = session?.user || null;

    return this;
  }

  // Load Supabase script dynamically
  loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (window.supabase) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Auth methods
  async signInWithGoogle() {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this.user = null;
    this.session = null;
  }

  isLoggedIn() {
    return !!this.user;
  }

  getToken() {
    return this.session?.access_token;
  }

  // API helper with auth
  async api(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.session?.access_token) {
      headers['Authorization'] = `Bearer ${this.session.access_token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await this.signOut();
        } catch (e) {}
      }
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Bot methods
  async getBotByCode(code) {
    return this.api(`/bots/code/${code}`);
  }

  async getMyBots() {
    return this.api('/bots');
  }

  async getMarketplaceBots() {
    return this.api('/bots/marketplace');
  }

  async createBot(botData) {
    return this.api('/bots', {
      method: 'POST',
      body: JSON.stringify(botData)
    });
  }

  async updateBot(botId, updates) {
    return this.api(`/bots/${botId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteBot(botId) {
    return this.api(`/bots/${botId}`, {
      method: 'DELETE'
    });
  }

  // Chat methods
  async getChats() {
    return this.api('/chats');
  }

  async getChat(chatId) {
    return this.api(`/chats/${chatId}`);
  }

  async createChat(botId) {
    return this.api('/chats', {
      method: 'POST',
      body: JSON.stringify({ bot_id: botId })
    });
  }

  async sendMessage(chatId, text, replyTo = null) {
    return this.api(`/chats/${chatId}/message`, {
      method: 'POST',
      body: JSON.stringify({ text, replyTo })
    });
  }

  async deleteChat(chatId) {
    return this.api(`/chats/${chatId}`, {
      method: 'DELETE'
    });
  }

  // Utility methods
  async getRobloxUser(userId) {
    return this.api(`/roblox/${userId}`);
  }

  async searchRobloxUser(username) {
    return this.api(`/roblox/search/${username}`);
  }

  async generatePrompt(description, robloxUsername, robloxDisplayName) {
    return this.api('/generate-prompt', {
      method: 'POST',
      body: JSON.stringify({ description, robloxUsername, robloxDisplayName })
    });
  }

  async getSupportBot() {
    return this.api('/support-bot');
  }

  // Profile methods
  async getProfile() {
    return this.api('/auth/me');
  }

  async updateProfile(data) {
    return this.api('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // TOTP methods
  async setupTOTP() {
    return this.api('/auth/totp/setup', { method: 'POST' });
  }

  async verifyTOTP(code) {
    return this.api('/auth/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }
}

// Create global instance
window.essx = new ChatBotsClient();
