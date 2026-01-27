// ============================================================
// iMessage Chat App
// ============================================================

console.log('🚀 APP.JS LOADING...');

const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const gradientBg = document.getElementById('gradientBg');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const menuBtn = document.getElementById('menuBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const searchBtn = document.getElementById('searchBtn');
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const searchClose = document.getElementById('searchClose');
const replyPreview = document.getElementById('replyPreview');
const replyPreviewText = document.getElementById('replyPreviewText');
const replyPreviewClose = document.getElementById('replyPreviewClose');
const loadingOverlay = document.getElementById('loadingOverlay');
const contactName = document.getElementById('contactName');
const avatarImg = document.getElementById('avatarImg');
const charCounter = document.getElementById('charCounter');
const contactModal = document.getElementById('contactModal');
const headerCenter = document.getElementById('headerCenter');
const closeContactModal = document.getElementById('closeContactModal');
const messageContact = document.getElementById('messageContact');
const modalAvatar = document.getElementById('modalAvatar');
const modalName = document.getElementById('modalName');
const modalUsername = document.getElementById('modalUsername');
const modalPlatform = document.getElementById('modalPlatform');
const modalStatus = document.getElementById('modalStatus');
const modalBio = document.getElementById('modalBio');
const marketplaceBtn = document.getElementById('marketplaceBtn');
const marketplaceModal = document.getElementById('marketplaceModal');
const closeMarketplaceModal = document.getElementById('closeMarketplaceModal');
const marketplaceList = document.getElementById('marketplaceList');
const marketplaceRefreshBtn = document.getElementById('marketplaceRefreshBtn');
const tutorialModal = document.getElementById('tutorialModal');
const tutorialCloseBtn = document.getElementById('tutorialCloseBtn');
const tutorialDoneBtn = document.getElementById('tutorialDoneBtn');
const tutorialMarketplaceBtn = document.getElementById('tutorialMarketplaceBtn');

// New modal elements
const loginScreen = document.getElementById('loginScreen');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const loginHint = document.getElementById('loginHint');
const loadingSplash = document.getElementById('loadingSplash');
const loadingText = document.getElementById('loadingText');
const totpSignupBtn = document.getElementById('totpSignupBtn');
const totpModal = document.getElementById('totpModal');
const closeTotpModal = document.getElementById('closeTotpModal');
const addBotModal = document.getElementById('addBotModal');
const closeAddBotModal = document.getElementById('closeAddBotModal');
const createBotModal = document.getElementById('createBotModal');
const closeCreateBotModal = document.getElementById('closeCreateBotModal');
const closeCreateBotModal2 = document.getElementById('closeCreateBotModal2');
const closeCreateBotModal3 = document.getElementById('closeCreateBotModal3');
const myBotsModal = document.getElementById('myBotsModal');
const closeMyBotsModal = document.getElementById('closeMyBotsModal');
const myBotsList = document.getElementById('myBotsList');

console.log('DOM Elements:', {
  chatArea: !!chatArea,
  chatInput: !!chatInput,
  newChatBtn: !!newChatBtn,
  chatList: !!chatList,
  sidebar: !!sidebar,
  avatarImg: !!avatarImg,
  gradientBg: !!gradientBg,
  loginScreen: !!loginScreen
});

// ============================================================
// AUTH & SUPABASE INTEGRATION
// ============================================================

let isAuthenticated = false;
let currentUser = null;
let useSupabase = false; // Flag to switch between localStorage and Supabase
let loginPending = false;
const LOGIN_HINT_DEFAULT = 'You’ll be redirected to Google and back.';
const TUTORIAL_KEY = 'imessage_tutorial_seen_v1';
const LOADING_TEXT_DEFAULT = 'Chat Bots';
let authTransitionActive = false;
let loadingHideTimer = null;
let loadingRemoveTimer = null;

function setLoginHint(text) {
  if (loginHint) {
    loginHint.textContent = text || LOGIN_HINT_DEFAULT;
  }
}

function showLoadingSplash(text) {
  if (!loadingSplash) return;
  if (loadingHideTimer) clearTimeout(loadingHideTimer);
  if (loadingRemoveTimer) clearTimeout(loadingRemoveTimer);
  loadingSplash.classList.remove('hidden');
  loadingSplash.style.display = 'flex';
  loadingSplash.style.pointerEvents = 'auto';
  if (loadingText && text) {
    loadingText.textContent = text;
  }
}

function clearBlockingOverlays({ keepTutorial = false } = {}) {
  document.querySelectorAll('.modal-backdrop.visible').forEach(el => {
    if (keepTutorial && el.id === 'tutorialModal') return;
    el.classList.remove('visible');
  });
  contactModal?.classList.remove('active');
  closeSidebar();
}

function resetLoginState() {
  loginPending = false;
  if (googleLoginBtn) {
    googleLoginBtn.disabled = false;
    googleLoginBtn.classList.remove('loading');
  }
  setLoginHint();
}

// Initialize Supabase client
async function initSupabase() {
  try {
    if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL) {
      console.log('📦 No Supabase config found, using local mode');
      return false;
    }

    await window.essx.init();

    // Set up auth change listener
    window.essx.onAuthChange = (event, session) => {
      console.log('🔐 Auth state changed:', event);
      if (session) {
        handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        handleSignOut();
      }
    };

    // Check if already logged in
    if (window.essx.isLoggedIn()) {
      await handleAuthSuccess(window.essx.user);
      return true;
    }

    // Show login screen
    showLoginScreen();

    // On mobile OAuth redirects, session detection can be slightly delayed
    setTimeout(async () => {
      if (window.essx?.isLoggedIn?.() && !isAuthenticated) {
        await handleAuthSuccess(window.essx.user);
      }
    }, 1200);
    return true;
  } catch (err) {
    console.error('Supabase init failed:', err);
    return false;
  }
}

function showLoginScreen() {
  if (loginScreen) {
    loginScreen.classList.remove('hidden');
  }
  closeSidebar();
  resetLoginState();
}

function hideLoginScreen() {
  if (loginScreen) {
    loginScreen.classList.add('hidden');
  }
}

async function handleAuthSuccess(user) {
  console.log('✅ Auth success:', user?.email);
  authTransitionActive = true;
  showLoadingSplash('Signing you in…');
  isAuthenticated = true;
  currentUser = user;
  useSupabase = true;

  resetLoginState();
  hideLoginScreen();
  closeSidebar();
  clearBlockingOverlays();

  // Load chats from Supabase
  try {
    await withTimeout(loadChatsFromSupabase(), 9000);
  } catch (e) {
    console.error('Chat load timed out/failed:', e);
  } finally {
    renderChatList();
    renderMessages();
    updateHeader();
    authTransitionActive = false;
    hideLoadingSplash({ immediate: true, force: true });
  }

  // Setup user menu in sidebar
  setupUserMenu();

  maybeShowTutorial();
}

function handleSignOut() {
  isAuthenticated = false;
  currentUser = null;
  useSupabase = false;
  state.chats = {};
  state.currentChatId = null;
  authTransitionActive = false;

  resetLoginState();
  clearBlockingOverlays();
  hideLoadingSplash({ immediate: true, force: true });
  showLoginScreen();
  renderChatList();
}

function setupUserMenu() {
  const template = document.getElementById('userMenuTemplate');
  if (!template || !currentUser) return;

  // Remove existing user menu if any
  const existingSidebar = sidebar?.querySelector('.user-menu');
  if (existingSidebar) existingSidebar.remove();

  const userMenu = template.content.cloneNode(true);

  const userAvatar = userMenu.querySelector('#userAvatar');
  const userName = userMenu.querySelector('#userName');
  const myBotsBtn = userMenu.querySelector('#myBotsBtn');
  const logoutBtn = userMenu.querySelector('#logoutBtn');

  if (userAvatar) {
    userAvatar.src = currentUser.user_metadata?.avatar_url || 'https://via.placeholder.com/32';
  }
  if (userName) {
    userName.textContent = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User';
  }

  if (myBotsBtn) {
    myBotsBtn.addEventListener('click', async () => {
      await loadMyBots();
      openModal(myBotsModal);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.essx.signOut();
    });
  }

  sidebar?.appendChild(userMenu);
}

async function loadChatsFromSupabase() {
  try {
    const chats = await window.essx.getChats();

    // Transform Supabase chats to local format
    state.chats = {};
    for (const chat of chats) {
      const bot = chat.bots;
      state.chats[chat.id] = {
        id: chat.id,
        botId: chat.bot_id,
        name: bot?.roblox_username || bot?.name || 'Unknown',
        botName: bot?.name || bot?.roblox_username || 'Bot',
        robloxUsername: bot?.roblox_username || null,
        description: bot?.description || '',
        avatarUrl: bot?.roblox_avatar_url,
        shareCode: bot?.share_code,
        messages: chat.messages || [],
        conversation: chat.conversation || [],
        notes: chat.notes || [],
        updatedAt: new Date(chat.updated_at).getTime(),
        isSupport: bot?.share_code === 'HELP'
      };
    }

    // Ensure support chat exists
    await ensureSupportChat();

    // Set current chat to most recent or support
    const sortedChats = Object.values(state.chats).sort((a, b) => {
      if (a.isSupport) return -1;
      if (b.isSupport) return 1;
      return b.updatedAt - a.updatedAt;
    });

    if (sortedChats.length > 0) {
      state.currentChatId = sortedChats[0].id;
    }

    renderChatList();
    renderMessages();
    updateHeader();

    console.log('📨 Loaded', Object.keys(state.chats).length, 'chats from Supabase');
  } catch (err) {
    console.error('Failed to load chats:', err);
  }
}

async function ensureSupportChat() {
  // Check if support chat exists
  const supportChat = Object.values(state.chats).find(c => c.isSupport);
  if (supportChat) return;

  try {
    // For support bot, we need to handle it specially since it's a system bot
    // Create chat via API
    const result = await window.essx.api('/chats', {
      method: 'POST',
      body: JSON.stringify({ bot_id: '00000000-0000-0000-0000-000000000001' })
    });

    if (result.id) {
      state.chats[result.id] = {
        id: result.id,
        botId: result.bot_id,
        name: 'Support',
        avatarUrl: null,
        shareCode: 'HELP',
        messages: [],
        conversation: [],
        notes: [],
        updatedAt: Date.now(),
        isSupport: true
      };
    }
  } catch (err) {
    console.log('Support chat creation handled:', err.message);
  }
}

function maybeShowTutorial() {
  if (!tutorialModal) return;
  if (localStorage.getItem(TUTORIAL_KEY)) return;
  localStorage.setItem(TUTORIAL_KEY, '1');
  openModal(tutorialModal);
}

async function loadMyBots() {
  if (!useSupabase || !myBotsList) return;
  myBotsList.innerHTML = '<div class="empty-state"><div class="empty-state-text">Loading bots…</div></div>';
  try {
    const bots = await window.essx.getMyBots();
    renderMyBots(bots);
  } catch (err) {
    console.error('Failed to load my bots:', err);
    myBotsList.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load bots</div></div>';
  }
}

function renderMyBots(bots) {
  if (!myBotsList) return;
  if (!bots || bots.length === 0) {
    myBotsList.innerHTML = '<div class="empty-state"><div class="empty-state-text">No bots yet</div></div>';
    return;
  }

  const profileName = currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'User';
  const profileAvatar = currentUser?.user_metadata?.avatar_url || 'https://via.placeholder.com/40';

  const profileCard = `
    <div class="profile-card">
      <img class="profile-card-avatar" src="${profileAvatar}" alt="${profileName}">
      <div class="profile-card-info">
        <div class="profile-card-name">${profileName}</div>
        <div class="profile-card-meta">${bots.length} bot${bots.length === 1 ? '' : 's'}</div>
      </div>
    </div>
  `;

  const botsHtml = bots.map(bot => {
    const avatar = bot.roblox_avatar_url ? `<img src="${bot.roblox_avatar_url}" alt="${bot.name || bot.roblox_username || 'Bot'}">` : '';
    const name = bot.name || bot.roblox_username || 'Bot';
    const username = bot.roblox_username ? `@${bot.roblox_username}` : bot.share_code;
    const chats = typeof bot.chat_count === 'number' ? `${bot.chat_count} chats` : '';
    const prompt = (bot.system_prompt || '').trim();

    return `
      <div class="my-bot-item" data-bot-id="${bot.id}">
        <div class="my-bot-avatar">${avatar}</div>
        <div class="my-bot-content">
          <div class="my-bot-header">
            <div class="my-bot-name">${name}</div>
            <div class="my-bot-meta">${username}${chats ? ` • ${chats}` : ''}</div>
          </div>
          <label class="modal-checkbox my-bot-public">
            <input type="checkbox" data-bot-public="${bot.id}" ${bot.is_public ? 'checked' : ''}>
            <span>Public in Marketplace</span>
          </label>
          <textarea class="modal-textarea my-bot-prompt" data-bot-prompt="${bot.id}" rows="4">${prompt}</textarea>
          <div class="my-bot-actions">
            <button class="modal-btn secondary" data-bot-save="${bot.id}">Save Prompt</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  myBotsList.innerHTML = `${profileCard}${botsHtml}`;

  myBotsList.querySelectorAll('input[data-bot-public]').forEach(input => {
    input.addEventListener('change', () => updateBotPublic(input.dataset.botPublic, input.checked));
  });
  myBotsList.querySelectorAll('button[data-bot-save]').forEach(btn => {
    btn.addEventListener('click', () => updateBotPrompt(btn.dataset.botSave));
  });
}

async function updateBotPublic(botId, isPublic) {
  try {
    await window.essx.updateBot(botId, { is_public: !!isPublic });
    await loadMarketplace();
  } catch (err) {
    console.error('Failed to update bot visibility:', err);
    alert('Could not update visibility');
  }
}

async function updateBotPrompt(botId) {
  const promptEl = myBotsList?.querySelector(`textarea[data-bot-prompt="${botId}"]`);
  if (!promptEl) return;
  const prompt = promptEl.value.trim();
  if (!prompt) {
    alert('Prompt cannot be empty');
    return;
  }
  try {
    await window.essx.updateBot(botId, { system_prompt: prompt });
    promptEl.classList.add('saved');
    setTimeout(() => promptEl.classList.remove('saved'), 800);
  } catch (err) {
    console.error('Failed to update bot prompt:', err);
    alert('Could not update prompt');
  }
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

function openModal(modal) {
  if (modal) {
    modal.classList.add('visible');
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.remove('visible');
  }
}

// ============================================================
// TOTP AUTHENTICATOR SIGNUP
// ============================================================

let totpSignupState = {
  secret: null,
  qrCode: null
};

async function startTotpSignup() {
  try {
    // TOTP setup requires an authenticated Supabase user (server verifies via Bearer token)
    if (!window.essx?.isLoggedIn?.()) {
      alert('Please sign in first (Google), then set up your authenticator.');
      return;
    }

    const response = await window.essx.api('/auth/totp/setup', { method: 'POST' });

    const secret = response?.secret;
    const qrCodeUrl = response?.qrCode;

    if (!secret || !qrCodeUrl) {
      throw new Error('Missing secret/qrCode from server');
    }

    // Store for verification
    totpSignupState.secret = secret;
    totpSignupState.qrCode = qrCodeUrl;

    // Show step 1
    document.getElementById('totpSetupStep').style.display = 'block';
    document.getElementById('totpVerifyStep').style.display = 'none';
    document.getElementById('totpStepIndicator').textContent = 'Step 1 of 2: Scan QR Code';

    // Display QR code and secret
    const qrImg = document.getElementById('qrCodeImage');
    const secretCode = document.getElementById('secretCode');

    if (qrImg) qrImg.src = qrCodeUrl;
    if (secretCode) secretCode.textContent = secret.match(/.{1,4}/g).join(' ');

    openModal(totpModal);
  } catch (err) {
    console.error('TOTP signup start failed:', err);
    alert('Failed to generate authenticator setup');
  }
}

function showTotpVerifyStep() {
  if (!totpSignupState.secret) {
    alert('Please scan the QR code first');
    return;
  }

  document.getElementById('totpSetupStep').style.display = 'none';
  document.getElementById('totpVerifyStep').style.display = 'block';
  document.getElementById('totpStepIndicator').textContent = 'Step 2 of 2: Verify Code';

  // Clear and focus first digit
  document.querySelectorAll('.totp-digit').forEach(input => input.value = '');
  document.querySelector('.totp-digit')?.focus();
}

async function completeTotpSignup() {
  const digits = document.querySelectorAll('.totp-digit');
  const code = Array.from(digits).map(d => d.value).join('');

  if (code.length !== 6) {
    alert('Please enter 6 digits');
    return;
  }

  try {
    if (!window.essx?.isLoggedIn?.()) {
      alert('Please sign in first (Google).');
      return;
    }

    // Verify the code for the current user
    const response = await window.essx.api('/auth/totp/verify', {
      method: 'POST',
      body: JSON.stringify({
        code
      })
    });

    if (response.success) {
      closeModal(totpModal);
      alert('Authenticator enabled successfully.');
    }
  } catch (err) {
    console.error('Verification failed:', err);
    alert('Invalid code. Try again.');
  }
}

// Setup modal event listeners
function setupModals() {
  // Login buttons
  googleLoginBtn?.addEventListener('click', async () => {
    if (loginPending) return;
    loginPending = true;
    closeSidebar();
    if (googleLoginBtn) {
      googleLoginBtn.disabled = true;
      googleLoginBtn.classList.add('loading');
    }
    setLoginHint('Opening Google…');
    try {
      await window.essx.signInWithGoogle();
    } catch (err) {
      console.error('Google sign in failed:', err);
      resetLoginState();
      alert('Sign-in failed. Please try again.');
    }
  });

  totpSignupBtn?.addEventListener('click', async () => {
    await startTotpSignup();
  });

  closeTotpModal?.addEventListener('click', () => closeModal(totpModal));

  // TOTP setup next button
  document.getElementById('totpSetupNextBtn')?.addEventListener('click', showTotpVerifyStep);

  // TOTP verify button
  document.getElementById('verifyTotpBtn')?.addEventListener('click', completeTotpSignup);

  // TOTP digit inputs
  const totpDigits = document.querySelectorAll('.totp-digit');
  setupCodeInputs(totpDigits);

  // Add bot modal
  closeAddBotModal?.addEventListener('click', () => closeModal(addBotModal));

  // Code digit inputs
  const codeDigits = document.querySelectorAll('.code-digit');
  setupCodeInputs(codeDigits);

  // Add bot by code button
  document.getElementById('addBotByCodeBtn')?.addEventListener('click', addBotByCode);

  // Open create bot wizard
  document.getElementById('openCreateBotBtn')?.addEventListener('click', () => {
    closeModal(addBotModal);
    openModal(createBotModal);
    resetWizard();
  });

  // Create bot modal close buttons
  closeCreateBotModal?.addEventListener('click', () => closeModal(createBotModal));
  closeCreateBotModal2?.addEventListener('click', () => closeModal(createBotModal));
  closeCreateBotModal3?.addEventListener('click', () => closeModal(createBotModal));

  // Wizard navigation
  document.getElementById('wizardBack2')?.addEventListener('click', () => showWizardStep(1));

  // Wizard buttons
  document.getElementById('searchRobloxBtn')?.addEventListener('click', searchRobloxUser);
  document.getElementById('robloxInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchRobloxUser();
  });

  document.getElementById('wizardNext1')?.addEventListener('click', () => showWizardStep(2));
  document.getElementById('wizardNext2')?.addEventListener('click', generateBotPrompt);
  document.getElementById('startChatBtn')?.addEventListener('click', startChatWithNewBot);

  // Copy buttons
  document.getElementById('copyCodeBtn')?.addEventListener('click', () => {
    const code = document.getElementById('botShareCode')?.textContent;
    if (code) copyToClipboard(code, 'copyCodeBtn');
  });

  document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const link = document.getElementById('botShareLink')?.textContent;
    if (link) copyToClipboard(link, 'copyLinkBtn');
  });

  // My bots modal
  closeMyBotsModal?.addEventListener('click', () => closeModal(myBotsModal));
  document.getElementById('createNewBotBtn')?.addEventListener('click', () => {
    closeModal(myBotsModal);
    openModal(createBotModal);
    resetWizard();
  });

  // Update new chat button to open add bot modal
  if (newChatBtn) {
    newChatBtn.removeEventListener('click', createChat);
    newChatBtn.addEventListener('click', () => {
      if (useSupabase) {
        openModal(addBotModal);
      } else {
        createChat();
      }
    });
  }

  // Close modals on backdrop click
  [totpModal, addBotModal, createBotModal, myBotsModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function setupCodeInputs(inputs) {
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.toUpperCase();
      e.target.value = value;

      if (value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
      for (let i = 0; i < pasteData.length && i + index < inputs.length; i++) {
        inputs[index + i].value = pasteData[i];
      }
      const nextEmpty = Array.from(inputs).findIndex(inp => !inp.value);
      if (nextEmpty >= 0) inputs[nextEmpty].focus();
    });
  });
}

// ============================================================
// BOT CREATION WIZARD
// ============================================================

let wizardData = {
  robloxUserId: null,
  robloxUsername: null,
  robloxDisplayName: null,
  robloxAvatarUrl: null,
  description: null,
  systemPrompt: null,
  shareCode: null,
  botId: null,
  isPublic: false
};

function resetWizard() {
  wizardData = {
    robloxUserId: null,
    robloxUsername: null,
    robloxDisplayName: null,
    robloxAvatarUrl: null,
    description: null,
    systemPrompt: null,
    shareCode: null,
    botId: null,
    isPublic: false
  };

  document.getElementById('robloxInput').value = '';
  document.getElementById('robloxPreview').style.display = 'none';
  document.getElementById('robloxError').style.display = 'none';
  document.getElementById('wizardNext1').disabled = true;
  document.getElementById('botDescription').value = '';
  const publicToggle = document.getElementById('botIsPublic');
  if (publicToggle) publicToggle.checked = false;

  showWizardStep(1);
}

function showWizardStep(step) {
  document.getElementById('wizardStep1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('wizardStep2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('wizardStep3').style.display = step === 3 ? 'block' : 'none';
}

async function searchRobloxUser() {
  const input = document.getElementById('robloxInput').value.trim();
  if (!input) return;

  const preview = document.getElementById('robloxPreview');
  const error = document.getElementById('robloxError');
  const nextBtn = document.getElementById('wizardNext1');

  preview.style.display = 'none';
  error.style.display = 'none';
  nextBtn.disabled = true;

  try {
    let userData;

    // Check if input is numeric (user ID) or username
    if (/^\d+$/.test(input)) {
      userData = await window.essx.getRobloxUser(input);
    } else {
      userData = await window.essx.searchRobloxUser(input);
    }

    if (userData && userData.id) {
      wizardData.robloxUserId = userData.id;
      wizardData.robloxUsername = userData.username;
      wizardData.robloxDisplayName = userData.displayName;
      wizardData.robloxAvatarUrl = userData.avatarUrl;

      document.getElementById('robloxAvatar').src = userData.avatarUrl || 'https://via.placeholder.com/64';
      document.getElementById('robloxUsername').textContent = userData.displayName || userData.username;
      document.getElementById('robloxId').textContent = `@${userData.username} • ID: ${userData.id}`;

      preview.style.display = 'flex';
      nextBtn.disabled = false;
    } else {
      error.style.display = 'block';
    }
  } catch (err) {
    console.error('Roblox search failed:', err);
    error.style.display = 'block';
  }
}

async function generateBotPrompt() {
  const description = document.getElementById('botDescription').value.trim();
  if (!description) return;

  wizardData.description = description;
  wizardData.isPublic = !!document.getElementById('botIsPublic')?.checked;

  const btn = document.getElementById('wizardNext2');
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');

  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  btn.disabled = true;

  try {
    // Generate prompt using AI
    const result = await window.essx.generatePrompt(
      description,
      wizardData.robloxUsername,
      wizardData.robloxDisplayName
    );

    wizardData.systemPrompt = result.systemPrompt;

    // Create the bot
    const bot = await window.essx.createBot({
      roblox_user_id: wizardData.robloxUserId,
      roblox_username: wizardData.robloxUsername,
      roblox_avatar_url: wizardData.robloxAvatarUrl,
      name: wizardData.robloxDisplayName || wizardData.robloxUsername,
      description: description,
      system_prompt: wizardData.systemPrompt,
      is_public: wizardData.isPublic
    });

    wizardData.shareCode = bot.share_code;
    wizardData.botId = bot.id;

    // Update step 3 UI
    document.getElementById('botAvatar').src = wizardData.robloxAvatarUrl || 'https://via.placeholder.com/80';
    document.getElementById('botName').textContent = wizardData.robloxDisplayName || wizardData.robloxUsername;
    document.getElementById('botShareCode').textContent = wizardData.shareCode;
    document.getElementById('botShareLink').textContent = `${window.location.origin}/b/${wizardData.shareCode}`;

    showWizardStep(3);
  } catch (err) {
    console.error('Bot creation failed:', err);
    alert('Failed to create bot: ' + err.message);
  } finally {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
    btn.disabled = false;
  }
}

async function startChatWithNewBot() {
  if (!wizardData.botId) return;

  try {
    // Create chat with the new bot
    const chat = await window.essx.createChat(wizardData.botId);

    // Add to local state
    state.chats[chat.id] = {
      id: chat.id,
      botId: wizardData.botId,
      name: wizardData.robloxDisplayName || wizardData.robloxUsername,
      avatarUrl: wizardData.robloxAvatarUrl,
      shareCode: wizardData.shareCode,
      messages: [],
      conversation: [],
      notes: [],
      updatedAt: Date.now(),
      isSupport: false
    };

    state.currentChatId = chat.id;

    closeModal(createBotModal);
    renderChatList();
    renderMessages();
    updateHeader();

    // Send initial greeting
    greet();
  } catch (err) {
    console.error('Failed to start chat:', err);
  }
}

async function addBotByCode() {
  const codeInputs = document.querySelectorAll('.code-digit');
  const code = Array.from(codeInputs).map(i => i.value).join('').toUpperCase();

  if (code.length !== 4) {
    alert('Please enter a 4-digit code');
    return;
  }

  try {
    // Get bot by code
    const bot = await window.essx.getBotByCode(code);

    if (!bot) {
      alert('Bot not found with that code');
      return;
    }

    // Create chat with bot
    const chat = await window.essx.createChat(bot.id);

    // Add to local state
    state.chats[chat.id] = {
      id: chat.id,
      botId: bot.id,
      name: bot.roblox_username || bot.name,
      avatarUrl: bot.roblox_avatar_url,
      shareCode: bot.share_code,
      messages: [],
      conversation: [],
      notes: [],
      updatedAt: Date.now(),
      isSupport: bot.share_code === 'HELP'
    };

    state.currentChatId = chat.id;

    closeModal(addBotModal);

    // Clear code inputs
    codeInputs.forEach(i => i.value = '');

    renderChatList();
    renderMessages();
    updateHeader();

    // Send initial greeting
    if (!chat.existing) {
      greet();
    }
  } catch (err) {
    console.error('Failed to add bot:', err);
    alert('Failed to add bot: ' + err.message);
  }
}

function copyToClipboard(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    }
  });
}

// Config
const API_URL = "/chat";
const MODEL = "gpt-5.2";
const STORAGE_KEY = "imessage_chats_v2";

const systemPrompt = `text like a normal person - lowercase, short messages. use slang naturally (ngl, tbh, fr, lowkey, etc). be chill and friendly. never mention being an ai. max 150 chars per message.

IMPORTANT TONE RULES:
- Use authentic language including swears and profanity when naturally fit - don't censor yourself
- Be honest and raw with definitions and explanations
- Don't filter or sanitize explanations - keep it real
- Explain things exactly as they are used

RESPONSE RULES:
1. ALWAYS send a message. Never just a reaction.
2. React with [react:emoji] at START ONLY when genuinely important/emotional (rare). Example: [react:😂] lmaooo fr
3. Keep it casual and conversational like texting a friend
4. When you get tool results, refine and explain them naturally - don't just paste raw tool output

====================
CONVERSATION INTELLIGENCE
====================

CONTEXT AWARENESS:
- Track the flow of conversation - remember what was discussed earlier
- If user references "it", "that", "this" - figure out what they mean from context
- Notice patterns: if user keeps asking similar things, offer to help more proactively
- Pick up on subtext: "im bored" might mean they want entertainment suggestions

EMOTIONAL INTELLIGENCE:
- Match energy: if they're hyped, be hyped. if they're chill, be chill
- If someone seems down, be supportive without being preachy
- Celebrate their wins genuinely
- Don't be overly positive or fake - keep it real

SMART RESPONSES:
- If user asks a yes/no question, give a clear answer THEN explain if needed
- If user is frustrated, acknowledge it before solving
- Offer follow-up suggestions naturally: "want me to also check X?"
- When you don't know something, admit it casually: "ngl idk about that"

PROACTIVE HELPFULNESS:
- If user mentions a movie, offer to look it up
- If user mentions being somewhere, remember for weather/time context
- If user asks about one thing, anticipate related questions
- Suggest tools naturally: "want me to translate that?" or "i can look that up if u want"

====================
SMART FEATURES - USE THESE PROACTIVELY
====================

[INTERNAL:clarify] - When user's message is vague or ambiguous, ask a clarifying question instead of guessing
  Example: User says "do the thing" → Ask "wait which thing lol"
  Example: User says "look it up" → Ask "look up what?"

[INTERNAL:remember fact=FACT] - Remember something about the user for future conversations
  Example: User mentions they like anime → [INTERNAL:remember fact=likes anime]
  Example: User says their name → [INTERNAL:remember fact=name is X]
  Example: User says they're from Seattle → [INTERNAL:remember fact=from Seattle]
  ACTIVELY look for facts to remember - names, preferences, location, interests

[INTERNAL:mood mood=MOOD] - Track user's apparent mood (happy, sad, frustrated, excited, neutral)
  Adjust your responses accordingly - be more supportive if sad, match energy if excited

[INTERNAL:asklocation] - Request precise location from user's device
  Use this when user asks for weather/time without a location
  After getting location, AUTOMATICALLY proceed with their original request
  Don't wait for them to ask again - just do it

[INTERNAL:note note=TEXT] - Save a note about this conversation for later reference
  Example: User mentions they have an exam tomorrow → [INTERNAL:note note=has exam tomorrow]
  Example: User says they're working on a project → [INTERNAL:note note=working on coding project]
  Use this to remember things specific to THIS conversation that you might need later
  Notes are per-chat and help you provide better context-aware responses

[INTERNAL:checknotes] - Retrieve all saved notes for this conversation
  Use when you need to recall what you've learned in this specific chat

MEMORY SYSTEM:
- Pay attention when users share personal info (name, interests, favorites, location, job, hobbies)
- Reference remembered facts naturally in conversation
- Build rapport by showing you remember things about them
- Use their name occasionally once you know it

====================
TOOLS - USE THESE TO ASSIST WITH PROMPTS
====================

[TOOL:define term=WORD] - DEFINITIONS & WORD MEANINGS - HIGHEST PRIORITY
TRIGGER PHRASES: "what does X mean?" "what's X?" "define X" "meaning of X" "what is X slang"

CRITICAL: Extract the WORD and ALWAYS use term=WORD parameter!

EXACT FORMAT: [TOOL:define term=THEWORD]
The word after "term=" MUST be the word user is asking about!

AFTER GETTING DEFINITION RESULT: Refine it into natural conversational explanation
- Don't paste raw output
- Explain it in your own casual words
- Use swears/profanity freely if the word itself contains them or if it helps explain
- Make it sound like you're explaining to a friend
- Keep it short (under 150 chars)

EXAMPLES OF CORRECT USAGE:
1. User: "what does cap mean"
   Tool returns raw definition
   You respond naturally: "cap means lying or being fake lol, like no cap = no lie"

2. User: "what's bussin mean"
   Tool returns result
   You respond naturally: "bussin means something slaps hard or is really good fr"

3. User: "define sus"
   Tool returns result
   You respond naturally: "sus = suspicious, sketchy vibes. like if someone's acting sus they're being weird"

ALWAYS respond with [TOOL:define term=WORD] when user asks:
- "what does [word] mean" → use that word
- "what's [word]" → use that word
- "meaning of [word]" → use that word
- "define [word]" → use that word

EXISTING TOOLS:
[TOOL:joke] - DAD JOKES: Get joke, explain it naturally
[TOOL:quote] - QUOTES: Get quote, explain why it fits
[TOOL:trivia] - TRIVIA: Ask trivia question, don't just paste it
[TOOL:catfact] - CAT FACTS: Share the fact, make it interesting
[TOOL:fact] - RANDOM FACTS: Share the fact conversationally
[TOOL:weather city=CITY] - WEATHER: Report weather naturally (if no city given, it uses user's location)
[TOOL:news topic=TOPIC] - NEWS: Summarize the news naturally
[TOOL:crypto symbol=SYMBOL] - CRYPTO: Report price naturally
[TOOL:movie title=TITLE] - MOVIES: Summarize movie info naturally
[TOOL:location] - LOCATION: Tell where user is naturally
[TOOL:time] - TIME: Report time naturally
[TOOL:advice] - ADVICE: Get random life advice and share it casually
[TOOL:riddle] - RIDDLE: Get a riddle to challenge the user
[TOOL:horoscope sign=SIGN] - HOROSCOPE: Get daily horoscope for a zodiac sign
[TOOL:color] - COLOR: Get random color info for design/art discussions
[TOOL:8ball question=QUESTION] - MAGIC 8 BALL: Answer yes/no questions mystically
[TOOL:theme name=THEME] - THEME: Change app theme. Options: light, dark, glass, gradient, midnight, sunset
[TOOL:customtheme style=STYLE color=COLOR bg=BG bubble=BUBBLE] - CUSTOM THEME: Create a custom theme!
  - style: solid, glass, gradient, neon
  - color: blue, purple, pink, red, orange, yellow, green, teal, cyan, mint, indigo, violet, rose, coral, gold, lime (or hex like #FF5500)
  - bg: light, dark, amoled
  - bubble: rounded, pill, square, cloud
  Example: [TOOL:customtheme style=neon color=pink bg=amoled bubble=rounded]
  Example: [TOOL:customtheme style=glass color=#00CED1 bg=dark bubble=cloud]

NEW TOOLS:
[TOOL:wiki query=QUERY] - WIKIPEDIA: Search Wikipedia and summarize
[TOOL:calc expression=EXPR] - CALCULATOR: Evaluate math expressions
[TOOL:translate text=TEXT to=LANG] - TRANSLATE: Translate text to another language
[TOOL:wordofday] - WORD OF THE DAY: Get an interesting word with definition
[TOOL:dog] - RANDOM DOG: Get a cute dog image URL

CODE SANDBOX - CRITICAL FOR PROGRAMMING:
[TOOL:code lang=LANG]CODE[/TOOL:code] - CODE SANDBOX: YOU RUN THE CODE AND SHOW RESULTS
  - lang: javascript, js, html, css
  - YOU (the AI) execute the code immediately and display results automatically
  - The user sees the output right away - they don't need to click anything
  - Example: [TOOL:code lang=javascript]console.log("Hello, world!");[/TOOL:code]
  - Example: [TOOL:code lang=html]<h1>Hello!</h1><button onclick="alert('clicked!')">Click me</button>[/TOOL:code]

WHEN TO USE CODE SANDBOX:
- User asks "how do i..." for coding → ALWAYS provide working code in sandbox
- User wants to "try it out" or "test" something → use code sandbox
- Explaining a concept with code → use sandbox to demonstrate it
- User asks for examples → show in sandbox with live results
- User is learning to code → use sandbox for every example
- Quick demos or snippets → use sandbox to show what it does

IMPORTANT: YOU RUN IT - Don't ask the user to click anything
- Include the code in the sandbox
- The sandbox automatically executes it
- The user sees the output right away
- They can copy the code if they want

TOOL USAGE TIPS:
- For weather/time without location: the system will prompt user for location access
- "make it dark" → [TOOL:theme name=dark]
- "translate X to spanish" → [TOOL:translate text=X to=spanish]
- "what's 234 * 567" → [TOOL:calc expression=234*567]
- "tell me about X" (factual) → [TOOL:wiki query=X]

CRITICAL FOR ALL TOOLS:
After tool returns result, don't just paste it. Refine it into natural conversation.
Keep it casual, use swears if needed, explain it like talking to a friend.

You can combine multiple tools in one message: [TOOL:joke] [TOOL:quote]

====================
SMARTER CONVERSATIONS & INTELLIGENCE
====================

ANTICIPATION & PREDICTION:
- User asks "what's X" → think "they probably also want to know Y"
- If they like one thing, suggest similar things
- Notice when they're asking follow-up questions and provide extra context
- If they seem confused, break it down more before continuing

DEPTH OVER BREADTH:
- Don't just answer the literal question - understand WHY they're asking
- "how do i learn X" → offer resources, tips, roadmap - not just one answer
- "tell me about X" → give interesting angle, not boring facts
- Go deeper on topics they seem engaged with

WHEN TO USE MULTIPLE TOOLS:
- "what's the weather AND time" → [TOOL:weather] [TOOL:time]
- "i need jokes and advice" → [TOOL:joke] [TOOL:advice]
- Use multiple tools when user explicitly asks for multiple things
- But don't overload - stay focused on their main ask

SMART RECOMMENDATIONS:
- If user mentions coding → suggest code sandbox for examples
- If user asks definition → use define tool ALWAYS
- If user asks "should i" → offer to check related info (wiki, horoscope, 8ball for fun)
- If user wants to learn → always provide runnable examples in code sandbox

READING THE ROOM:
- Short responses = they want quick answers
- Long questions = they want detailed explanations
- Frustrated tone = acknowledge frustration, then solve
- Excited tone = match their energy
- Multiple questions at once = answer all, don't pick one

BUILDING CONTEXT:
- Remember what they said earlier in conversation
- Use names if you know them
- Reference their interests when relevant
- Make connections between topics they discuss

KEY RULE: Tools are powerful - use them wisely to make conversations BETTER.
Be proactive but not annoying. Smart, not showing off.
====================`;

let state = {
  chats: {},
  currentChatId: null,
  isSending: false,
  replyingTo: null,
  userLocation: null,
  preciseLocation: null, // Browser geolocation
  userProfile: {
    name: null,
    interests: [],
    facts: [],
    mood: 'neutral',
    messageCount: 0,
    warningCount: 0,
    suspended: false,
    suspendedUntil: null
  }
};

// Load user profile from localStorage
const PROFILE_KEY = 'imessage_user_profile';
function loadUserProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      state.userProfile = { ...state.userProfile, ...JSON.parse(saved) };
      // Check if suspension has expired
      if (state.userProfile.suspendedUntil && Date.now() > state.userProfile.suspendedUntil) {
        state.userProfile.suspended = false;
        state.userProfile.suspendedUntil = null;
        saveUserProfile();
      }
    }
  } catch (e) { console.error('Profile load failed:', e); }
}

function saveUserProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(state.userProfile));
  } catch (e) { console.error('Profile save failed:', e); }
}

// Geolocation permission request
async function requestPreciseLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocode to get city name
        try {
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          const data = await response.json();

          // Check if we got a clear city or if location seems iffy (rural, between cities, etc)
          const city = data.city || data.locality || 'Unknown';
          const isIffy = !data.city || city === 'Unknown' || (data.confidence && data.confidence < 0.7);

          state.preciseLocation = {
            latitude,
            longitude,
            city: city,
            country: data.countryName || 'Unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            iffy: isIffy
          };

          console.log('📍 Precise location obtained:', state.preciseLocation);

          // If location is unclear and we have nearbyPlaces or similar data, offer clarification
          if (isIffy && data.localityInfo?.administrative) {
            const admins = data.localityInfo.administrative || [];
            const nearbyAreas = admins.map(a => a.name).filter(Boolean);
            if (nearbyAreas.length > 0) {
              state.preciseLocation.nearbyAreas = nearbyAreas;
              console.log('📍 Nearby areas for clarification:', nearbyAreas);
            }
          }

          resolve(state.preciseLocation);
        } catch (e) {
          state.preciseLocation = { latitude, longitude, city: 'Unknown', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
          resolve(state.preciseLocation);
        }
      },
      (error) => {
        console.log('Geolocation denied or failed:', error.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// Check if user needs geolocation prompt
function needsLocationPrompt(text) {
  const lowerText = text.toLowerCase();
  const locationKeywords = ['weather', 'temperature', 'forecast', 'time', 'what time'];
  const hasLocationKeyword = locationKeywords.some(kw => lowerText.includes(kw));
  const hasSpecificLocation = /(?:in|at|for)\s+[a-zA-Z\s]+/i.test(text);
  return hasLocationKeyword && !hasSpecificLocation && !state.preciseLocation;
}

// Content moderation
const INAPPROPRIATE_PATTERNS = [
  /\b(kys|kill\s*yourself|neck\s*yourself)\b/i,
  /\b(i('ll|m\s*going\s*to)\s*hurt\s*(myself|you|someone))\b/i,
  /\b(bomb\s*threat|shoot\s*up|mass\s*shooting)\b/i,
  /\b(n[i1]gg[ae3]r|f[a4]gg[o0]t|r[e3]t[a4]rd)\b/i
];

function checkContentModeration(text) {
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(text)) {
      state.userProfile.warningCount++;
      saveUserProfile();

      if (state.userProfile.warningCount >= 3) {
        // Suspend for 1 hour
        state.userProfile.suspended = true;
        state.userProfile.suspendedUntil = Date.now() + (60 * 60 * 1000);
        saveUserProfile();
        return { blocked: true, suspended: true, message: "yo you've been suspended for an hour. chill out fr" };
      }

      return { blocked: true, suspended: false, message: `that's not cool man. warning ${state.userProfile.warningCount}/3` };
    }
  }
  return { blocked: false };
}

// Load profile on init
loadUserProfile();

// ============================================================
// Storage
// ============================================================

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      chats: state.chats,
      currentChatId: state.currentChatId
    }));
  } catch (e) { console.error('Save failed:', e); }
}

function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      state.chats = parsed.chats || {};
      state.currentChatId = parsed.currentChatId;
      return Object.keys(state.chats).length > 0;
    }
  } catch (e) { console.error('Load failed:', e); }
  return false;
}

// Mood presets for different conversation styles
const moodPresets = {
  chill: {
    name: 'Chill Mode',
    prompt: 'be extra chill and relaxed. use more laid-back language. dont stress about anything. vibes only.'
  },
  hype: {
    name: 'Hype Mode',
    prompt: 'be super energetic and hyped up! use lots of exclamation marks! match big energy! get excited about everything!'
  },
  serious: {
    name: 'Serious Mode',
    prompt: 'be more thoughtful and serious. still casual but focus on giving good advice and real talk. less jokes, more substance.'
  },
  funny: {
    name: 'Comedy Mode',
    prompt: 'be extra funny and try to make jokes often. puns, wordplay, witty comebacks. keep things light and entertaining.'
  },
  supportive: {
    name: 'Support Mode',
    prompt: 'be extra supportive and caring. validate feelings. give encouragement. be there for them like a good friend would be.'
  },
  creative: {
    name: 'Creative Mode',
    prompt: 'be more creative and imaginative. think outside the box. suggest unique ideas. be artistic and expressive.'
  }
};

function createChat(mood = null) {
  const id = 'chat_' + Date.now();
  let chatSystemPrompt = systemPrompt;

  // Apply mood preset if specified
  if (mood && moodPresets[mood]) {
    chatSystemPrompt += `\n\nMOOD PRESET ACTIVE: ${moodPresets[mood].prompt}`;
  }

  state.chats[id] = {
    id,
    name: 'Bot',
    messages: [],
    conversation: [{ role: "system", content: chatSystemPrompt }],
    updatedAt: Date.now(),
    mood: mood || 'default',
    notes: [] // Per-chat notes the bot can reference
  };
  state.currentChatId = id;
  saveState();
  return id;
}

function getChat() {
  if (!state.currentChatId || !state.chats[state.currentChatId]) {
    if (!useSupabase) {
      createChat();
    } else {
      return null;
    }
  }
  return state.chats[state.currentChatId];
}

// Update header with current chat info
function updateHeader() {
  const chat = getChat();
  if (!chat) {
    if (contactName) contactName.textContent = 'Chat Bots';
    return;
  }

  const isSupport = chat.isSupport || chat.shareCode === 'HELP';

  if (contactName) {
    contactName.textContent = isSupport ? 'Support' : (chat.name || 'Bot');
  }

  if (avatarImg) {
    if (isSupport) {
      // Use a support icon or placeholder for support chat
      avatarImg.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#007AFF"/><text x="50" y="65" font-size="40" fill="white" text-anchor="middle">?</text></svg>');
    } else if (chat.avatarUrl) {
      avatarImg.src = chat.avatarUrl;
    }
    // Otherwise keep the default avatar that was loaded
  }

  updateContactModal(chat);
}

function deriveContactInfo(chat) {
  const isSupport = chat.isSupport || chat.shareCode === 'HELP';
  if (isSupport) {
    return {
      name: 'Support',
      username: '@support',
      platform: 'Chat Bots',
      status: 'Available',
      bio: 'Official support bot'
    };
  }

  const baseName = chat.botName || chat.name || 'Bot';
  const usernameBase = chat.robloxUsername || baseName;
  const cleanedUser = String(usernameBase).replace(/\s+/g, '').toLowerCase();
  const username = `@${cleanedUser.slice(0, 24)}`;

  const desc = (chat.description || '').trim();
  const promptHints = (chat.conversation || []).find(m => m.role === 'system')?.content || '';
  const sourceText = `${desc}\n${promptHints}`.toLowerCase();

  const status =
    sourceText.includes('sleep') ? 'Sleeping' :
    sourceText.includes('school') ? 'At school' :
    sourceText.includes('work') ? 'Working' :
    sourceText.includes('busy') ? 'Busy' :
    'Online';

  const bio = desc || baseName;

  return {
    name: baseName,
    username,
    platform: chat.robloxUsername ? 'Roblox' : 'Chat Bots',
    status,
    bio
  };
}

function updateContactModal(chat) {
  const info = deriveContactInfo(chat);
  if (modalName) modalName.textContent = info.name;
  if (modalUsername) modalUsername.textContent = info.username;
  if (modalPlatform) modalPlatform.textContent = info.platform;
  if (modalStatus) modalStatus.textContent = info.status;
  if (modalBio) modalBio.textContent = info.bio;

  if (modalAvatar) {
    const img = modalAvatar.querySelector('img');
    if (img && chat.avatarUrl) {
      img.src = chat.avatarUrl;
      img.alt = info.name;
    }
  }
}

// ============================================================
// Chat List
// ============================================================

function renderChatList() {
  if (!chatList) return;

  // Sort chats: support first, then by updatedAt
  const chats = Object.values(state.chats).sort((a, b) => {
    if (a.isSupport && !b.isSupport) return -1;
    if (!a.isSupport && b.isSupport) return 1;
    return b.updatedAt - a.updatedAt;
  });

  if (chats.length === 0) {
    chatList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-text">No chats yet</div></div>';
    return;
  }

  chatList.innerHTML = chats.map(chat => {
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg ? (lastMsg.text || '[Image]').substring(0, 35) : 'New chat';
    const time = formatTime(chat.updatedAt);
    const active = chat.id === state.currentChatId;
    const isSupport = chat.isSupport || chat.shareCode === 'HELP';

    // Determine avatar source
    let avatarContent;
    if (isSupport) {
      avatarContent = '?'; // Question mark for support
    } else if (chat.avatarUrl) {
      avatarContent = `<img src="${chat.avatarUrl}" alt="${chat.name}">`;
    } else if (avatarImg?.src) {
      avatarContent = `<img src="${avatarImg.src}">`;
    } else {
      avatarContent = chat.name?.charAt(0).toUpperCase() || 'E';
    }

    return `
      <div class="chat-item ${active ? 'active' : ''} ${isSupport ? 'support' : ''}" data-id="${chat.id}">
        <div class="chat-item-avatar">
          ${avatarContent}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-name">${isSupport ? '📌 Support' : chat.name}</div>
          <div class="chat-item-preview">${preview}</div>
        </div>
        <div class="chat-item-time">${time}</div>
        ${!isSupport ? `<button class="chat-item-delete" data-id="${chat.id}">Delete</button>` : ''}
      </div>
    `;
  }).join('');
  
  chatList.querySelectorAll('.chat-item').forEach(item => {
    const chatItem = item.querySelector('.chat-item-content, .chat-item-avatar, .chat-item-time');
    if (chatItem) {
      item.onclick = (e) => {
        if (!e.target.classList.contains('chat-item-delete')) {
          switchChat(item.dataset.id);
          closeSidebar();
        }
      };
    }
  });
  
  chatList.querySelectorAll('.chat-item-delete').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(btn.dataset.id);
    };
  });
}

async function deleteChat(id) {
  if (!confirm('Delete this conversation?')) return;

  const chatItem = chatList.querySelector(`.chat-item[data-id="${id}"]`);

  // Delete from Supabase if in that mode
  if (useSupabase) {
    try {
      await window.essx.deleteChat(id);
    } catch (err) {
      console.error('Failed to delete chat:', err);
      return;
    }
  }

  // Update local state immediately so UI doesn't require refresh
  delete state.chats[id];

  if (state.currentChatId === id) {
    const remaining = Object.keys(state.chats);
    if (remaining.length > 0) {
      state.currentChatId = remaining[0];
    } else if (!useSupabase) {
      createChat();
    } else {
      state.currentChatId = null;
    }
  }

  if (chatItem) {
    // Get all items and find index of deleted item
    const allItems = Array.from(chatList.querySelectorAll('.chat-item'));
    const deletedIndex = allItems.indexOf(chatItem);
    const itemHeight = chatItem.offsetHeight;

    // Swipe out the deleted item
    chatItem.classList.add('deleting');

    // Slide up items below the deleted one
    allItems.forEach((item, i) => {
      if (i > deletedIndex) {
        item.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        item.style.transform = `translateY(-${itemHeight}px)`;
      }
    });

    setTimeout(() => {
      // Reset transforms and remove deleted item
      allItems.forEach(item => {
        item.style.transition = '';
        item.style.transform = '';
      });

      if (!useSupabase) saveState();
      renderChatList();
      renderMessages();
      updateHeader();
    }, 300);
  } else {
    delete state.chats[id];
    if (!useSupabase) saveState();
    renderChatList();
    renderMessages();
    updateHeader();
  }
}

// Update just the chat preview without full re-render
function updateChatPreview(chatId) {
  const chat = state.chats[chatId];
  if (!chat) return;

  const chatItem = chatList.querySelector(`.chat-item[data-id="${chatId}"]`);
  if (!chatItem) return;

  const lastMsg = chat.messages[chat.messages.length - 1];
  const preview = lastMsg ? (lastMsg.text || '[Image]').substring(0, 35) : 'New chat';
  const time = formatTime(chat.updatedAt);

  const previewEl = chatItem.querySelector('.chat-item-preview');
  const timeEl = chatItem.querySelector('.chat-item-time');

  if (previewEl) previewEl.textContent = preview;
  if (timeEl) timeEl.textContent = time;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  
  if (diff === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function switchChat(id) {
  if (!state.chats[id]) return;
  state.currentChatId = id;
  if (!useSupabase) saveState();
  renderChatList();
  renderMessages();
  updateHeader();
}

// ============================================================
// Sidebar
// ============================================================

function openSidebar() {
  sidebar?.classList.add('open');
  sidebarBackdrop?.classList.add('visible');
}

function closeSidebar() {
  sidebar?.classList.remove('open');
  sidebarBackdrop?.classList.remove('visible');
}

menuBtn?.addEventListener('click', openSidebar);
sidebarBackdrop?.addEventListener('click', closeSidebar);
marketplaceBtn?.addEventListener('click', async () => {
  await loadMarketplace();
  openModal(marketplaceModal);
});
closeMarketplaceModal?.addEventListener('click', () => closeModal(marketplaceModal));
marketplaceRefreshBtn?.addEventListener('click', loadMarketplace);
tutorialCloseBtn?.addEventListener('click', () => closeModal(tutorialModal));
tutorialDoneBtn?.addEventListener('click', () => closeModal(tutorialModal));
tutorialMarketplaceBtn?.addEventListener('click', async () => {
  closeModal(tutorialModal);
  await loadMarketplace();
  openModal(marketplaceModal);
});

if (newChatBtn) {
  console.log('🎯 NEW CHAT BTN FOUND, attaching listener');
  newChatBtn.addEventListener('click', function(e) {
    console.log('🔵 NEW CHAT BUTTON CLICKED - Event fired!');
    e.preventDefault();

    try {
      // Fade out current chat area smoothly
      chatArea?.classList.add('switching');

      setTimeout(() => {
        const newId = createChat();
        console.log('✅ New chat created:', newId);

        state.currentChatId = newId;
        saveState();

        renderChatList();

        if (chatArea) {
          chatArea.innerHTML = '';
        }

        closeSidebar();

        // Fade back in
        requestAnimationFrame(() => {
          chatArea?.classList.remove('switching');
        });

        setTimeout(() => {
          console.log('⏱️ Greeting starting');
          greet();
        }, 100);
      }, 150);

    } catch (e) {
      console.error('❌ Error:', e);
    }
  });
  console.log('✅ New chat button listener attached');
} else {
  console.error('❌ NEW CHAT BTN NOT FOUND!');
}

// ============================================================
// Messages
// ============================================================

function renderMessages() {
  if (!chatArea) return;

  const chat = getChat();
  chatArea.innerHTML = '';

  if (chat.messages.length === 0) return;

  const sep = document.createElement('div');
  sep.className = 'time-separator';
  sep.textContent = 'Today';
  chatArea.appendChild(sep);

  chat.messages.forEach((msg, i) => addMessageToDOM(msg, i, false));

  // Smooth scroll after content loads
  requestAnimationFrame(() => {
    scrollToBottom();
  });
}

async function loadMarketplace() {
  if (!useSupabase || !marketplaceList) return;
  marketplaceList.innerHTML = '<div class="empty-state"><div class="empty-state-text">Loading marketplace…</div></div>';
  try {
    const bots = await window.essx.getMarketplaceBots();
    renderMarketplace(bots);
  } catch (err) {
    console.error('Failed to load marketplace:', err);
    marketplaceList.innerHTML = '<div class="empty-state"><div class="empty-state-text">Failed to load marketplace</div></div>';
  }
}

function renderMarketplace(bots) {
  if (!marketplaceList) return;
  if (!bots || bots.length === 0) {
    marketplaceList.innerHTML = '<div class="empty-state"><div class="empty-state-text">No public bots yet</div></div>';
    return;
  }

  marketplaceList.innerHTML = bots.map(bot => {
    const avatar = bot.roblox_avatar_url
      ? `<img src="${bot.roblox_avatar_url}" alt="${bot.name || bot.roblox_username || 'Bot'}">`
      : '';
    const name = bot.name || bot.roblox_username || 'Bot';
    const user = bot.roblox_username ? `@${bot.roblox_username}` : bot.share_code;
    const chats = typeof bot.chat_count === 'number' ? `${bot.chat_count} chats` : '';
    const desc = (bot.description || '').trim() || 'No description';

    return `
      <div class="marketplace-item">
        <div class="marketplace-item-avatar">${avatar}</div>
        <div class="marketplace-item-content">
          <div class="marketplace-item-name">${name}</div>
          <div class="marketplace-item-meta">${user}${chats ? ` • ${chats}` : ''}</div>
          <div class="marketplace-item-desc">${desc}</div>
        </div>
        <div class="marketplace-item-action">
          <button class="modal-btn primary" data-bot-id="${bot.id}">Chat</button>
        </div>
      </div>
    `;
  }).join('');

  marketplaceList.querySelectorAll('button[data-bot-id]').forEach(btn => {
    btn.addEventListener('click', () => marketplaceStartChat(btn.dataset.botId));
  });
}

async function marketplaceStartChat(botId) {
  if (!botId || !useSupabase) return;
  try {
    const result = await window.essx.createChat(botId);
    await loadChatsFromSupabase();
    if (result?.id) {
      state.currentChatId = result.id;
      renderChatList();
      renderMessages();
      updateHeader();
    }
    closeModal(marketplaceModal);
    closeSidebar();
  } catch (err) {
    console.error('Failed to start chat from marketplace:', err);
    alert('Could not start chat');
  }
}

function addMessageToDOM(msg, idx, isNew = true) {
  const wrapper = document.createElement('div');
  const wrapperClass = msg.isSystem ? 'system' : msg.type;
  wrapper.className = `message-wrapper ${wrapperClass}${isNew ? ' new-message' : ''}`;
  wrapper.dataset.idx = idx;
  
  const container = document.createElement('div');
  container.className = 'bubble-container';
  
  if (msg.replyTo) {
    const quote = document.createElement('div');
    quote.className = 'reply-quote';
    quote.textContent = msg.replyTo.substring(0, 40) + (msg.replyTo.length > 40 ? '...' : '');
    container.appendChild(quote);
  }
  
  const bubble = document.createElement('div');
  bubble.className = `bubble ${msg.type}`;

  if (msg.image) {
    bubble.classList.add('image');
    bubble.innerHTML = `<img src="${msg.image}">`;
  } else {
    let text = msg.text || '';

    // Check for code sandbox blocks: [TOOL:code lang=X]code[/TOOL:code]
    const codeSandboxRegex = /\[TOOL:code\s+lang=(\w+)\]([\s\S]*?)\[\/TOOL:code\]/gi;
    const codeBlocks = [];
    let codeMatch;

    while ((codeMatch = codeSandboxRegex.exec(text)) !== null) {
      const placeholder = `__CODE_SANDBOX_${codeBlocks.length}__`;
      codeBlocks.push({ lang: codeMatch[1], code: codeMatch[2].trim(), placeholder });
      text = text.replace(codeMatch[0], placeholder);
    }

    // Check for image URLs in text - match both explicit image extensions and common image CDNs
    const imageUrlRegex = /(https?:\/\/[^\s<>"{}|\\^`]*\.(?:jpg|jpeg|png|gif|webp|svg|jpe)(?:[?#].*)?|https:\/\/(?:images\.|cdn\.|img\.|static\.|media\.|.*\.(?:dog|ceo|imgur|imgix|cloudinary|fastly)|images[0-9]*\.)[^\s<>"{}|\\^`]*)/gi;
    const imageMatches = text.match(imageUrlRegex);

    if (imageMatches?.length > 0) {
      // Replace image URLs with img tags, keep other text linkified
      let htmlContent = linkify(sanitize(text));
      imageMatches.forEach(imgUrl => {
        const cleanUrl = imgUrl.replace(/[.,;:!?\)]*$/, '');
        const imgTag = `<img src="${cleanUrl}" style="max-width:100%;max-height:250px;border-radius:12px;margin-top:8px;display:block;" onerror="this.style.display='none';">`;
        htmlContent = htmlContent.replace(new RegExp(cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imgTag);
      });
      bubble.innerHTML = htmlContent;
    } else {
      bubble.innerHTML = linkify(sanitize(text));
    }

    // Insert code sandbox blocks
    if (codeBlocks.length > 0 && typeof createCodeSandbox === 'function') {
      codeBlocks.forEach(({ lang, code, placeholder }) => {
        const placeholderText = bubble.innerHTML;
        if (placeholderText.includes(placeholder)) {
          const parts = placeholderText.split(placeholder);
          bubble.innerHTML = parts[0];
          bubble.appendChild(createCodeSandbox(code, lang));
          if (parts[1]) {
            const remaining = document.createElement('span');
            remaining.innerHTML = parts[1];
            bubble.appendChild(remaining);
          }
        }
      });
    }
  }

  container.appendChild(bubble);

  if (msg.text) {
    const urls = msg.text.match(/https?:\/\/[^\s]+/gi);
    if (urls?.length) {
      // Only add link preview for non-image URLs
      const nonImageUrl = urls.find(url =>
        !/(jpg|jpeg|png|gif|webp|svg|jpe)$/i.test(url) &&
        !/(images\.|cdn\.|img\.|static\.|media\.|dog|ceo|imgur|imgix|cloudinary|fastly)/.test(url)
      );
      if (nonImageUrl) addLinkPreview(container, nonImageUrl);
    }
  }
  
  if (msg.reaction) {
    const r = document.createElement('div');
    r.className = `reaction ${msg.type}`;
    r.textContent = msg.reaction;
    container.appendChild(r);
  }
  
  wrapper.appendChild(container);
  
  if (msg.type === 'sent') {
    const receipt = document.createElement('div');
    receipt.className = 'read-receipt';
    receipt.textContent = msg.readAt ? `Read ${formatReadTime(msg.readAt)}` : 'Delivered';
    wrapper.appendChild(receipt);
  }
  
  chatArea.appendChild(wrapper);

  if (isNew && msg.type === 'received') {
    triggerGradientPulse('receiving');
  }
}

function formatReadTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
}

function scrollToBottom(instant = false) {
  if (!chatArea) return;

  if (instant) {
    chatArea.scrollTop = chatArea.scrollHeight;
    return;
  }

  // Smooth scroll with custom easing for a polished feel
  const targetScroll = chatArea.scrollHeight;
  const currentScroll = chatArea.scrollTop;
  const distance = targetScroll - currentScroll;

  // If already near bottom or small distance, snap instantly
  if (distance < 50) {
    chatArea.scrollTop = targetScroll;
    return;
  }

  // Use native smooth scroll for most cases
  chatArea.scrollTo({
    top: targetScroll,
    behavior: 'smooth'
  });
}

// ============================================================
// Utilities
// ============================================================

function sanitize(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function linkify(t) {
  // First, replace URLs that have spaces in them (sometimes APIs return them this way)
  // This regex finds patterns like "https:// example . com / path" and removes spaces
  let cleaned = t.replace(/https?:\/\/\s*([^\s<>"{}|\\^`]*(?:\s+[^\s<>"{}|\\^`]+)*)/gi, (match) => {
    return match.replace(/\s+/g, '');
  });

  // Now linkify the cleaned text
  return cleaned.replace(/(https?:\/\/[^\s<>"{}|\\^`\]]*)/gi, (url) => {
    // Clean up trailing punctuation if present
    let cleanUrl = url;
    while (cleanUrl.match(/[.,;:!?\)]$/)) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    return `<a href="${cleanUrl}" target="_blank" style="color:inherit;text-decoration:underline">${cleanUrl}</a>`;
  });
}

function addLinkPreview(container, url) {
  try {
    const host = new URL(url).hostname;
    const p = document.createElement('div');
    p.className = 'link-preview';
    p.innerHTML = `<div class="link-preview-row"><img class="link-preview-favicon" src="https://www.google.com/s2/favicons?domain=${host}&sz=64" onerror="this.remove()"><div class="link-preview-text"><div class="link-preview-title">${host}</div><div class="link-preview-domain">${host}</div></div></div>`;
    p.onclick = () => window.open(url, '_blank');
    container.appendChild(p);
  } catch (e) {}
}

// Gradient state management
function setGradientState(gradientState) {
  if (!gradientBg) return;
  gradientBg.classList.remove('typing', 'sending', 'receiving', 'focused');
  if (gradientState) {
    gradientBg.classList.add(gradientState);
  }
}

function triggerGradientPulse(type = 'sending') {
  if (!gradientBg) return;
  setGradientState(type);
  clearTimeout(window.gradientTimeout);
  window.gradientTimeout = setTimeout(() => {
    setGradientState(null);
  }, type === 'sending' ? 1200 : 2500);
}

// ============================================================
// Typing
// ============================================================

function showTyping() {
  hideTyping();
  setGradientState('receiving');
  const w = document.createElement('div');
  w.className = 'typing-wrapper';
  w.id = 'typing';
  w.innerHTML = '<div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
  chatArea.appendChild(w);
  scrollToBottom();
}

function hideTyping() {
  document.getElementById('typing')?.remove();
  // Don't clear gradient here - let triggerGradientPulse handle the timeout
}

// ============================================================
// Send Message (Supabase Mode)
// ============================================================

async function sendMessageSupabase(text) {
  state.isSending = true;
  sendBtn.disabled = true;

  triggerGradientPulse('sending');

  const chat = getChat();
  if (!chat) {
    state.isSending = false;
    sendBtn.disabled = false;
    return;
  }

  const replyTo = state.replyingTo;

  // Add user message to UI immediately
  const userMsg = {
    type: 'sent',
    text: text,
    timestamp: Date.now(),
    replyTo: replyTo || null
  };

  chat.messages.push(userMsg);
  addMessageToDOM(userMsg, chat.messages.length - 1, true);
  const userMsgIndex = chat.messages.length - 1;

  chatInput.value = '';
  chat.updatedAt = Date.now();
  updateChatPreview(state.currentChatId);
  scrollToBottom();
  autoResizeTextarea();

  showTyping();

  try {
    // Send message via Supabase API
    const response = await window.essx.sendMessage(chat.id, text, replyTo);

    hideTyping();

    if (response.assistantMessage) {
      if (response.userMessage) {
        chat.messages[userMsgIndex] = {
          ...chat.messages[userMsgIndex],
          ...response.userMessage
        };
      }

      // Update read receipt on the user's last message
      if (response.userMessage?.readAt) {
        chat.messages[userMsgIndex].readAt = response.userMessage.readAt;
        const receiptEl = chatArea.querySelector('.message-wrapper.sent:last-of-type .read-receipt');
        if (receiptEl) {
          receiptEl.textContent = `Read ${formatReadTime(response.userMessage.readAt)}`;
        }
      }

      // Add assistant message to local state
      chat.messages.push(response.assistantMessage);
      chat.conversation = response.conversation || chat.conversation;

      // Display the response with chunking for natural feel
      await displayResponseChunked(response.assistantMessage.text, chat);
    }

  } catch (error) {
    console.error('Send error:', error);
    hideTyping();

    const errorMsg = {
      type: 'received',
      text: 'my bad something broke lol',
      timestamp: Date.now()
    };

    chat.messages.push(errorMsg);
    addMessageToDOM(errorMsg, chat.messages.length - 1, true);
  } finally {
    state.replyingTo = null;
    replyPreview?.classList.remove('active');
  }

  state.isSending = false;
  sendBtn.disabled = false;
  scrollToBottom();
  updateChatPreview(state.currentChatId);
}

// Display response with chunking for natural typing feel
async function displayResponseChunked(text, chat) {
  // Simple chunking - split on sentence boundaries
  const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim();
    if (!chunk) continue;

    const msg = {
      type: 'received',
      text: chunk,
      timestamp: Date.now()
    };

    if (i === 0) {
      // First chunk - add to DOM
      addMessageToDOM(msg, chat.messages.length - 1, true);
    } else {
      // Additional chunks - add as new messages
      chat.messages.push(msg);
      addMessageToDOM(msg, chat.messages.length - 1, true);
    }

    scrollToBottom();

    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    }
  }
}

// ============================================================
// Send Message
// ============================================================

async function sendMessage() {
  const text = chatInput.value.trim();

  if (!text) return;
  if (state.isSending) return;

  // Check if user is suspended
  if (state.userProfile.suspended) {
    if (state.userProfile.suspendedUntil && Date.now() > state.userProfile.suspendedUntil) {
      state.userProfile.suspended = false;
      state.userProfile.suspendedUntil = null;
      saveUserProfile();
    } else {
      const remaining = Math.ceil((state.userProfile.suspendedUntil - Date.now()) / 60000);
      alert(`you're suspended for ${remaining} more minutes. chill.`);
      return;
    }
  }

  // Content moderation
  const modResult = checkContentModeration(text);
  if (modResult.blocked) {
    const chat = getChat();
    const warningMsg = {
      type: 'received',
      text: modResult.message,
      timestamp: Date.now()
    };
    chat.messages.push(warningMsg);
    addMessageToDOM(warningMsg, chat.messages.length - 1, true);
    chatInput.value = '';
    if (!useSupabase) saveState();
    return;
  }

  // Use Supabase API when in that mode
  if (useSupabase) {
    await sendMessageSupabase(text);
    return;
  }

  state.isSending = true;
  sendBtn.disabled = true;

  // Trigger sending gradient animation immediately
  triggerGradientPulse('sending');

  // Update user profile stats
  state.userProfile.messageCount++;
  saveUserProfile();

  const chat = getChat();

  const userMsg = {
    type: 'sent',
    text: text,
    timestamp: Date.now(),
    replyTo: state.replyingTo
  };

  chat.messages.push(userMsg);
  addMessageToDOM(userMsg, chat.messages.length - 1, true);

  chat.conversation.push({ role: 'user', content: text });

  chatInput.value = '';
  state.replyingTo = null;
  replyPreview?.classList.remove('active');

  chat.updatedAt = Date.now();
  saveState();
  updateChatPreview(state.currentChatId);

  scrollToBottom();
  autoResizeTextarea();

  // Mark as read BEFORE responding
  const userMsgIndex = chat.messages.length - 1;
  chat.messages[userMsgIndex].readAt = Date.now();
  const receipt = chatArea.querySelector('.message-wrapper.sent:last-of-type .read-receipt');
  if (receipt) {
    receipt.textContent = `Read ${formatReadTime(chat.messages[userMsgIndex].readAt)}`;
  }
  saveState();

  showTyping();

  try {
    // Build input array for OpenAI Responses API
    const inputMessages = chat.conversation.map((msg) => {
      let content = msg.content;

      // Inject user profile context into system prompt
      if (msg.role === 'system') {
        // Add user profile facts
        if (state.userProfile.facts.length > 0) {
          const factsStr = state.userProfile.facts.join(', ');
          content += `\n\nUSER CONTEXT (remembered facts about this user): ${factsStr}`;
        }
        if (state.userProfile.name) {
          content += `\nUser's name: ${state.userProfile.name}`;
        }
        if (state.userProfile.mood !== 'neutral') {
          content += `\nCurrent mood seems: ${state.userProfile.mood}`;
        }

        // Add per-chat notes
        const currentChat = getChat();
        if (currentChat.notes?.length > 0) {
          const notesStr = currentChat.notes.map(n => n.text).join('; ');
          content += `\n\nCHAT NOTES (things noted in this specific conversation): ${notesStr}`;
        }
      }

      return {
        role: msg.role === 'system' ? 'developer' : msg.role,
        content: content
      };
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        input: inputMessages,
        text: {
          format: { type: "text" }
        },
        reasoning: {
          effort: "low",
          summary: "auto"
        },
        tools: [],
        store: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error('API request failed');
    }

    const data = await response.json();
    console.log('API Response:', data);
    hideTyping();

    // Parse gpt-5-nano response (Responses API format)
    let assistantText = null;

    // Responses API returns output as an array with message objects
    if (data.output && Array.isArray(data.output)) {
      const messageObj = data.output.find(item => item.type === 'message');
      if (messageObj?.content?.[0]?.text) {
        assistantText = messageObj.content[0].text;
      }
    }

    if (assistantText && assistantText.trim()) {
      await processAssistantMessage(assistantText.trim(), chat);
    } else {
      console.error('No text in response:', data);
      throw new Error('Empty response from API');
    }

  } catch (error) {
    console.error('Send error:', error);
    hideTyping();

    const errorMsg = {
      type: 'received',
      text: 'my bad something broke lol',
      timestamp: Date.now()
    };

    chat.messages.push(errorMsg);
    chat.conversation.push({ role: 'assistant', content: errorMsg.text });
    addMessageToDOM(errorMsg, chat.messages.length - 1, true);

    saveState();
  }

  state.isSending = false;
  sendBtn.disabled = false;
  scrollToBottom();
}

// ============================================================
// Process Assistant Message
// ============================================================

async function processAssistantMessage(text, chat, skipTools = false) {
  // Check if AI wants to call tools - format: [TOOL:name param=value]
  // Use matchAll to find ALL tool calls in the message
  const toolMatches = [...text.matchAll(/\[TOOL:(\w+)(?:\s+([^\]]*))?\]/g)];

  // Only process tools if not already in a tool response flow (prevents loops)
  if (toolMatches.length > 0 && !skipTools) {
    // Process all tools and collect results
    const toolResults = [];

    for (const toolMatch of toolMatches) {
      const toolName = toolMatch[1];
      const paramString = toolMatch[2] || '';
      const params = {};

      // Parse parameters from "key=value key2=value2" format
      if (paramString) {
        const paramPairs = paramString.match(/(\w+)=([^\s]+)/g) || [];
        paramPairs.forEach(pair => {
          const [key, val] = pair.split('=');
          if (key && val) {
            params[key.trim()] = val.trim();
          }
        });
      }

      console.log('Tool call:', { toolName, params, paramString });

      // Call the appropriate API
      let result;
      try {
        switch (toolName.toLowerCase()) {
          case 'weather':
            // Use precise location if available and no city specified
            let weatherCity = params.city;
            if (!weatherCity && state.preciseLocation) {
              weatherCity = state.preciseLocation.city;
            }
            result = await callAPI('/weather', { city: weatherCity || 'New York' });
            break;
          case 'news':
            result = await callAPI('/news', { q: params.topic || 'technology' });
            break;
          case 'crypto':
            result = await callAPI('/crypto', { symbol: params.symbol || 'bitcoin' });
            break;
          case 'fact':
            result = await callAPI('/fact');
            break;
          case 'quote':
            result = await callAPI('/quote');
            break;
          case 'joke':
            result = await callAPI('/joke');
            break;
          case 'catfact':
            result = await callAPI('/catfact');
            break;
          case 'location':
            result = await callAPI('/location');
            break;
          case 'trivia':
            result = await callAPI('/trivia');
            break;
          case 'define':
            result = await callAPI('/define', { term: params.term || 'bruh' });
            break;
          case 'movie':
            result = await callAPI('/movie', { title: params.title || 'Inception' });
            break;
          case 'time':
            result = await callAPI('/time', { tz: state.userLocation?.timezone || 'America/New_York' });
            break;
          case 'advice':
            result = await callAPI('/advice');
            break;
          case 'riddle':
            result = await callAPI('/riddle');
            break;
          case 'horoscope':
            result = await callAPI('/horoscope', { sign: params.sign || 'aries' });
            break;
          case 'color':
            result = await callAPI('/color');
            break;
          case '8ball':
            result = await callAPI('/8ball', { question: params.question || 'Will it happen?' });
            break;
          case 'theme':
            const themeName = (params.name || 'light').toLowerCase();
            if (THEMES.includes(themeName)) {
              setTheme(themeName);
              result = { success: true, theme: themeName, message: `Theme changed to ${themeName}` };
            } else {
              result = { error: `Unknown theme. Available: ${THEMES.join(', ')}` };
            }
            break;
          case 'customtheme':
            // Create custom theme from AI
            const customConfig = {
              style: (params.style || 'solid').toLowerCase(),
              color: (params.color || 'blue').toLowerCase(),
              customColor: params.color?.startsWith('#') ? params.color : (colorPalette[params.color] || '#007AFF'),
              background: (params.bg || 'dark').toLowerCase(),
              bubbleStyle: (params.bubble || 'rounded').toLowerCase(),
              glassIntensity: 60,
              blurAmount: 50,
              gradientDirection: 135,
              animations: { orbs: true, gradient: false, glow: params.style === 'neon', pulse: true }
            };

            // Validate options
            const validStyles = ['solid', 'glass', 'gradient', 'neon'];
            const validBgs = ['light', 'dark', 'amoled'];
            const validBubbles = ['rounded', 'pill', 'square', 'cloud'];

            if (!validStyles.includes(customConfig.style)) customConfig.style = 'solid';
            if (!validBgs.includes(customConfig.background)) customConfig.background = 'dark';
            if (!validBubbles.includes(customConfig.bubbleStyle)) customConfig.bubbleStyle = 'rounded';

            // Apply the custom theme
            if (typeof applyCustomTheme === 'function') {
              applyCustomTheme(customConfig);
              localStorage.setItem('imessage_custom_theme', JSON.stringify(customConfig));
              result = {
                success: true,
                style: customConfig.style,
                color: customConfig.color,
                background: customConfig.background,
                bubble: customConfig.bubbleStyle,
                message: `Custom ${customConfig.style} theme created with ${customConfig.color} accent`
              };
            } else {
              result = { error: 'Custom theme function not available' };
            }
            break;
          case 'wiki':
            result = await callAPI('/wiki', { query: params.query || 'Wikipedia' });
            break;
          case 'calc':
            result = await callAPI('/calc', { expression: params.expression || '1+1' });
            break;
          case 'translate':
            result = await callAPI('/translate', { text: params.text || 'hello', to: params.to || 'spanish' });
            break;
          case 'wordofday':
            result = await callAPI('/wordofday');
            break;
          case 'dog':
            result = await callAPI('/dog');
            break;
          case 'code':
            // Code sandbox - the code is embedded in the message
            // We just acknowledge it and let the message renderer handle it
            result = { success: true, message: 'Code sandbox ready', lang: params.lang || 'javascript' };
            break;
          default:
            result = { error: 'Unknown tool' };
        }
      } catch (e) {
        result = { error: 'Tool call failed' };
      }

      toolResults.push({ tool: toolName, result });
    }

    // Add tool results to conversation
    chat.conversation.push({ role: 'assistant', content: text });
    const resultsText = toolResults.map(tr => `${tr.tool}: ${JSON.stringify(tr.result)}`).join(' | ');
    chat.conversation.push({ role: 'user', content: `Tool results: ${resultsText}` });

    // Ask AI to respond with the tool data
    showTyping();

    try {
      // Build input array for OpenAI Responses API with user context
      const inputMessages = chat.conversation.map((msg) => {
        let content = msg.content;

        // Inject user profile context into system prompt
        if (msg.role === 'system') {
          if (state.userProfile.facts.length > 0) {
            const factsStr = state.userProfile.facts.join(', ');
            content += `\n\nUSER CONTEXT (remembered facts about this user): ${factsStr}`;
          }
          if (state.userProfile.name) {
            content += `\nUser's name: ${state.userProfile.name}`;
          }
          if (state.userProfile.mood !== 'neutral') {
            content += `\nCurrent mood seems: ${state.userProfile.mood}`;
          }
          // Add per-chat notes
          if (chat.notes?.length > 0) {
            const notesStr = chat.notes.map(n => n.text).join('; ');
            content += `\n\nCHAT NOTES (things noted in this specific conversation): ${notesStr}`;
          }
        }

        return {
          role: msg.role === 'system' ? 'developer' : msg.role,
          content: content
        };
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          input: inputMessages,
          text: {
            format: { type: "text" }
          },
          reasoning: {
            effort: "low",
            summary: "auto"
          },
          tools: [],
          store: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tool response API error:', response.status, errorText);
        hideTyping();
        return;
      }

      const data = await response.json();
      hideTyping();

      // Parse response (Responses API format)
      let finalText = null;

      if (data.output && Array.isArray(data.output)) {
        const messageObj = data.output.find(item => item.type === 'message');
        if (messageObj?.content?.[0]?.text) {
          finalText = messageObj.content[0].text;
        }
      }

      if (finalText && finalText.trim()) {
        // Process the response but skip tool processing to prevent loops
        await processAssistantMessage(finalText.trim(), chat, true);
      }
    } catch (e) {
      console.error('Tool response error:', e);
      hideTyping();
    }

    return;
  }

  // Process internal commands (not shown to user)
  const internalMatches = [...text.matchAll(/\[INTERNAL:(\w+)(?:\s+([^\]]*))?\]/g)];
  for (const match of internalMatches) {
    const cmd = match[1];
    const paramString = match[2] || '';
    const params = {};

    if (paramString) {
      const paramPairs = paramString.match(/(\w+)=([^\s]+)/g) || [];
      paramPairs.forEach(pair => {
        const [key, val] = pair.split('=');
        if (key && val) params[key.trim()] = val.trim();
      });
    }

    switch (cmd.toLowerCase()) {
      case 'remember':
        if (params.fact) {
          state.userProfile.facts.push(params.fact);
          // Keep only last 20 facts
          if (state.userProfile.facts.length > 20) {
            state.userProfile.facts = state.userProfile.facts.slice(-20);
          }
          saveUserProfile();
          console.log('📝 Remembered:', params.fact);
        }
        break;
      case 'mood':
        if (params.mood) {
          state.userProfile.mood = params.mood;
          saveUserProfile();
          console.log('😊 Mood updated:', params.mood);
        }
        break;
      case 'asklocation':
        // Trigger geolocation request - this happens async (no user-visible messages)
        (async () => {
          const chat = getChat();

          // Request location silently
          const location = await requestPreciseLocation();

          if (location) {
            console.log('✅ Location granted:', location);
            // Add location to conversation so AI knows where user is for weather/time tools
            chat.conversation.push({ role: 'system', content: `User's location: ${location.city}, ${location.country}. Now automatically proceed with their weather/time request using this location.` });
            saveState();

            // Auto-fetch weather since that's usually why location was requested
            showTyping();
            try {
              const weatherResult = await callAPI('/weather', { city: location.city });
              chat.conversation.push({ role: 'user', content: `[Auto-fetched weather for ${location.city}]: ${JSON.stringify(weatherResult)}` });

              // Ask AI to respond with the weather
              const inputMessages = chat.conversation.map((msg) => ({
                role: msg.role === 'system' ? 'developer' : msg.role,
                content: msg.content
              }));

              const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: MODEL,
                  input: inputMessages,
                  text: { format: { type: "text" } },
                  reasoning: { effort: "low", summary: "auto" },
                  tools: [],
                  store: false
                })
              });

              hideTyping();
              if (response.ok) {
                const data = await response.json();
                let assistantText = null;
                if (data.output && Array.isArray(data.output)) {
                  const messageObj = data.output.find(item => item.type === 'message');
                  if (messageObj?.content?.[0]?.text) {
                    assistantText = messageObj.content[0].text;
                  }
                }
                if (assistantText && assistantText.trim()) {
                  await processAssistantMessage(assistantText.trim(), chat, true);
                }
              }
            } catch (e) {
              console.error('Auto-weather fetch failed:', e);
              hideTyping();
            }
          } else {
            console.log('❌ Location denied');
            // Add to conversation so AI knows permission was denied
            chat.conversation.push({ role: 'system', content: 'User denied location access' });
            saveState();

            // Let user know
            showTyping();
            setTimeout(() => {
              hideTyping();
              const denyMsg = {
                type: 'received',
                text: 'no worries, cant do weather without location tho. you can try again or tell me a city',
                timestamp: Date.now()
              };
              chat.messages.push(denyMsg);
              chat.conversation.push({ role: 'assistant', content: denyMsg.text });
              addMessageToDOM(denyMsg, chat.messages.length - 1, true);
              saveState();
              scrollToBottom();
            }, 500);
          }
        })();
        break;
      case 'note':
        // Save a note specific to this chat
        if (params.note) {
          const chat = getChat();
          if (!chat.notes) chat.notes = [];
          chat.notes.push({
            text: params.note,
            timestamp: Date.now()
          });
          // Keep only last 15 notes per chat
          if (chat.notes.length > 15) {
            chat.notes = chat.notes.slice(-15);
          }
          saveState();
          console.log('📝 Chat note saved:', params.note);
        }
        break;
      case 'checknotes':
        // Notes are automatically injected into context, this is just for logging
        const currentChat = getChat();
        if (currentChat.notes?.length > 0) {
          console.log('📋 Chat notes:', currentChat.notes.map(n => n.text).join(', '));
        } else {
          console.log('📋 No chat notes yet');
        }
        break;
    }
  }

  // Remove internal commands and tool calls from text (tool calls should never be shown to user)
  let cleanText = text.replace(/\[INTERNAL:[^\]]+\]/g, '').replace(/\[TOOL:[^\]]+\]/g, '').trim();

  // Normal message processing (no tool call)
  let reaction = null;

  const reactionMatch = cleanText.match(/^\[react:([^\]]+)\]\s*/);
  if (reactionMatch) {
    reaction = reactionMatch[1];
    cleanText = cleanText.replace(reactionMatch[0], '');
  }

  // If there's a reaction, apply it to the PREVIOUS (user's) message
  if (reaction && chat.messages.length > 0) {
    const lastUserMsgIndex = chat.messages.length - 1;
    const lastMsg = chat.messages[lastUserMsgIndex];
    if (lastMsg?.type === 'sent') {
      lastMsg.reaction = reaction;
      // Update the DOM for the reaction
      const userWrapper = chatArea.querySelector(`.message-wrapper[data-idx="${lastUserMsgIndex}"]`);
      if (userWrapper) {
        let reactionEl = userWrapper.querySelector('.reaction');
        if (reactionEl) {
          reactionEl.textContent = reaction;
        } else {
          const container = userWrapper.querySelector('.bubble-container');
          const r = document.createElement('div');
          r.className = 'reaction sent';
          r.textContent = reaction;
          container.appendChild(r);
        }
      }
    }
  }

  // Chunk the message into natural breaks (sentences, periods, etc)
  const chunks = chunkMessage(cleanText);

  chat.conversation.push({ role: 'assistant', content: text });

  // Send chunks with delays between them (skip if no actual text after cleaning)
  if (cleanText.trim()) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue; // Skip empty chunks

      const assistantMsg = {
        type: 'received',
        text: chunk,
        timestamp: Date.now()
      };

      chat.messages.push(assistantMsg);
      addMessageToDOM(assistantMsg, chat.messages.length - 1, true);

      // Wait before sending next chunk (except on last one)
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
      }
    }
  }

  chat.updatedAt = Date.now();
  saveState();
  updateChatPreview(state.currentChatId);
  scrollToBottom();
}

// Chunk message into smaller pieces for more natural typing
function chunkMessage(text) {
  // Split on sentences (. ! ?) but keep the punctuation
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];

  // Group sentences into chunks of 1-2 sentences to keep ~50-80 chars per chunk
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if ((currentChunk + ' ' + trimmed).length > 80 && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk += ' ' + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

// Helper to call API endpoints
async function callAPI(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return await res.json();
}

// ============================================================
// Greeting
// ============================================================

async function greet() {
  console.log('📢 GREET CALLED');
  const chat = getChat();

  if (chat.messages.length > 0) {
    console.log('⏭️ Chat has messages, skipping greeting');
    return;
  }

  console.log('👋 Showing greeting typing...');
  showTyping();

  await new Promise(r => setTimeout(r, 1000));

  hideTyping();

  const greetings = ['yo', 'hey', 'sup', 'hi'];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  const msg = {
    type: 'received',
    text: greeting,
    timestamp: Date.now()
  };

  chat.messages.push(msg);
  chat.conversation.push({ role: 'assistant', content: greeting });

  if (chatArea) {
    const sep = document.createElement('div');
    sep.className = 'time-separator';
    sep.textContent = 'Today';
    chatArea.appendChild(sep);
  }

  addMessageToDOM(msg, 0, true);

  chat.updatedAt = Date.now();
  saveState();
  renderChatList();

  console.log('✅ Greeting complete');
}

// ============================================================
// Reply
// ============================================================

replyPreviewClose?.addEventListener('click', () => {
  state.replyingTo = null;
  replyPreview?.classList.remove('active');
});

// ============================================================
// Search
// ============================================================

let searchResults = [];
let currentSearchIndex = 0;

function clearSearch() {
  searchBar?.classList.remove('active');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.search-highlight, .search-highlight-current').forEach(el => {
    el.classList.remove('search-highlight', 'search-highlight-current');
  });
  searchResults = [];
  currentSearchIndex = 0;
  updateSearchCounter();
}

function updateSearchCounter() {
  const counter = document.getElementById('searchCounter');
  if (!counter) return;

  if (searchResults.length === 0) {
    counter.textContent = '';
  } else {
    counter.textContent = `${currentSearchIndex + 1} of ${searchResults.length}`;
  }
}

function highlightSearchResults(query) {
  document.querySelectorAll('.search-highlight, .search-highlight-current').forEach(el => {
    el.classList.remove('search-highlight', 'search-highlight-current');
  });

  searchResults = [];

  if (!query || query.length < 2) {
    updateSearchCounter();
    return;
  }

  document.querySelectorAll('.bubble').forEach(bubble => {
    if (bubble.textContent.toLowerCase().includes(query.toLowerCase())) {
      bubble.classList.add('search-highlight');
      searchResults.push(bubble);
    }
  });

  currentSearchIndex = 0;
  if (searchResults.length > 0) {
    searchResults[0].classList.add('search-highlight-current');
    searchResults[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  updateSearchCounter();
}

function navigateSearch(direction) {
  if (searchResults.length === 0) return;

  searchResults[currentSearchIndex].classList.remove('search-highlight-current');

  if (direction === 'next') {
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
  } else {
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
  }

  searchResults[currentSearchIndex].classList.add('search-highlight-current');
  searchResults[currentSearchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  updateSearchCounter();
}

searchBtn?.addEventListener('click', () => {
  searchBar?.classList.add('active');
  searchInput?.focus();
});

searchClose?.addEventListener('click', clearSearch);

searchInput?.addEventListener('input', (e) => {
  highlightSearchResults(e.target.value);
});

searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    navigateSearch(e.shiftKey ? 'prev' : 'next');
  } else if (e.key === 'Escape') {
    clearSearch();
  }
});

// Add search navigation buttons
const searchPrevBtn = document.getElementById('searchPrev');
const searchNextBtn = document.getElementById('searchNext');

searchPrevBtn?.addEventListener('click', () => navigateSearch('prev'));
searchNextBtn?.addEventListener('click', () => navigateSearch('next'));

// ============================================================
// Input Handling
// ============================================================

function autoResizeTextarea() {
  if (!chatInput) return;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
}

chatInput?.addEventListener('input', () => {
  autoResizeTextarea();
  sendBtn.disabled = !chatInput.value.trim();

  // Update character counter
  updateCharCounter();

  // Trigger typing gradient animation
  if (chatInput.value.trim() && !state.isSending) {
    setGradientState('typing');
  } else if (!chatInput.value.trim() && !state.isSending) {
    setGradientState('focused');
  }
});

function updateCharCounter() {
  if (!charCounter || !chatInput) return;
  const len = chatInput.value.length;
  const max = 300;

  if (len === 0) {
    charCounter.textContent = '';
    charCounter.className = 'char-counter';
  } else if (len > max * 0.9) {
    charCounter.textContent = `${len}/${max}`;
    charCounter.className = 'char-counter danger';
  } else if (len > max * 0.7) {
    charCounter.textContent = `${len}/${max}`;
    charCounter.className = 'char-counter warning';
  } else {
    charCounter.textContent = `${len}/${max}`;
    charCounter.className = 'char-counter';
  }
}

chatInput?.addEventListener('focus', () => {
  if (!state.isSending) {
    setGradientState('focused');
  }
});

chatInput?.addEventListener('blur', () => {
  if (!state.isSending && !chatInput.value.trim()) {
    setGradientState(null);
  }
});

chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled && !state.isSending) {
      sendMessage();
    }
  }
});

sendBtn?.addEventListener('click', () => {
  if (!state.isSending) sendMessage();
});

// ============================================================
// Swipe to Reply (Touch)
// ============================================================

let touchStartX = 0;
let touchCurrentX = 0;
let swipingElement = null;

chatArea?.addEventListener('touchstart', (e) => {
  const wrapper = e.target.closest('.message-wrapper');
  if (!wrapper || wrapper.classList.contains('typing-wrapper')) return;

  touchStartX = e.touches[0].clientX;
  swipingElement = wrapper;
  wrapper.classList.add('swiping');
}, { passive: true });

chatArea?.addEventListener('touchmove', (e) => {
  if (!swipingElement) return;

  touchCurrentX = e.touches[0].clientX;
  const diff = touchCurrentX - touchStartX;

  if (diff > 30) {
    swipingElement.classList.add('swipe-active');
    swipingElement.style.transform = `translateX(${Math.min(diff, 60)}px)`;
  }
}, { passive: true });

chatArea?.addEventListener('touchend', () => {
  if (!swipingElement) return;

  const diff = touchCurrentX - touchStartX;

  if (diff > 80) {
    const idx = swipingElement.dataset.idx;
    const chat = getChat();
    const msg = chat.messages[idx];

    if (msg) {
      state.replyingTo = msg.text || '[Image]';
      replyPreviewText.textContent = state.replyingTo;
      replyPreview?.classList.add('active');
      chatInput?.focus();
    }
  }

  swipingElement.classList.remove('swiping', 'swipe-active');
  swipingElement.style.transform = '';
  swipingElement = null;
  touchStartX = 0;
  touchCurrentX = 0;
});

// ============================================================
// Long Press for Reactions (Touch)
// ============================================================

let longPressTimer;
let longPressTarget;

chatArea?.addEventListener('touchstart', (e) => {
  const bubble = e.target.closest('.bubble');
  if (!bubble) return;

  longPressTarget = bubble;
  longPressTimer = setTimeout(() => {
    showReactionPicker(bubble);
  }, 500);
}, { passive: true });

chatArea?.addEventListener('touchend', () => {
  clearTimeout(longPressTimer);
  longPressTarget = null;
});

chatArea?.addEventListener('touchmove', () => {
  clearTimeout(longPressTimer);
  longPressTarget = null;
});

function showReactionPicker(bubble) {
  document.querySelectorAll('.reaction-picker').forEach(p => p.remove());

  const wrapper = bubble.closest('.message-wrapper');
  const container = bubble.closest('.bubble-container');
  const type = wrapper.classList.contains('sent') ? 'sent' : 'received';

  const picker = document.createElement('div');
  picker.className = `reaction-picker ${type}`;
  picker.innerHTML = '❤️ 👍 😂 😮 😢 🔥'.split(' ').map(e => `<span>${e}</span>`).join('');

  container.appendChild(picker);

  picker.querySelectorAll('span').forEach(span => {
    span.onclick = (e) => {
      e.stopPropagation();
      const idx = wrapper.dataset.idx;
      const chat = getChat();
      const msg = chat.messages[idx];

      if (msg) {
        msg.reaction = span.textContent;
        saveState();
        renderMessages();
      }

      picker.remove();
    };
  });

  setTimeout(() => {
    document.addEventListener('click', function closeReactionPicker(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeReactionPicker);
      }
    });
  }, 100);
}

// Desktop double-click reactions
chatArea?.addEventListener('dblclick', (e) => {
  const bubble = e.target.closest('.bubble');
  if (bubble) {
    showReactionPicker(bubble);
  }
});

// Context menu for reply (desktop)
chatArea?.addEventListener('contextmenu', (e) => {
  const wrapper = e.target.closest('.message-wrapper');
  if (!wrapper || wrapper.id === 'typing') return;

  e.preventDefault();

  const idx = wrapper.dataset.idx;
  const chat = getChat();
  const msg = chat.messages[idx];

  if (msg) {
    state.replyingTo = msg.text || '[Image]';
    if (replyPreviewText) replyPreviewText.textContent = state.replyingTo;
    replyPreview?.classList.add('active');
    chatInput?.focus();
  }
});

// ============================================================
// Avatar Loading
// ============================================================

async function loadAvatar() {
  try {
    const response = await fetch('/avatar');
    const data = await response.json();

    if (data?.data?.[0]?.imageUrl) {
      const url = data.data[0].imageUrl;
      if (avatarImg) avatarImg.src = url;

      const favicon = document.getElementById('favicon');
      if (favicon) favicon.href = url;
    }
  } catch (e) {
    console.log('Avatar load failed (expected in dev):', e.message);
  }
}

// ============================================================
// Location Detection
// ============================================================

async function detectUserLocation() {
  try {
    const response = await fetch('/location');
    const data = await response.json();

    if (data && !data.error) {
      state.userLocation = {
        city: data.city,
        country: data.country,
        timezone: data.timezone
      };
      console.log('📍 User location detected:', state.userLocation);
    }
  } catch (e) {
    console.log('Location detection failed (expected in dev):', e.message);
  }
}

// ============================================================
// Init
// ============================================================

console.log('🎬 INIT STARTING...');

function withTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms))
  ]);
}

async function init() {
  console.log('⚙️ Init function called');

  // Setup modal event listeners
  setupModals();

  // Kick off non-critical startup tasks, but don't let them block the UI
  await Promise.allSettled([
    withTimeout(loadAvatar(), 1800),
    withTimeout(detectUserLocation(), 1800)
  ]);

  // Try to initialize Supabase
  const supabaseAvailable = await initSupabase();

  if (supabaseAvailable && window.essx?.isLoggedIn()) {
    // Supabase mode - chats already loaded in handleAuthSuccess
    console.log('🔐 Using Supabase mode');
  } else if (supabaseAvailable) {
    // Supabase available but not logged in - show login screen
    console.log('🔐 Supabase available, waiting for login');
    // Hide loading splash to show login screen
    hideLoadingSplash({ immediate: true, force: true });
    return; // Don't proceed until logged in
  } else {
    // Fallback to localStorage mode
    console.log('💾 Using localStorage mode');
    const hasChats = loadState();
    console.log('💾 Has existing chats:', hasChats);

    if (!hasChats) {
      console.log('🆕 No chats found, creating new one');
      createChat();
    }

    renderChatList();
    renderMessages();

    const chat = getChat();
    console.log('📊 Current chat messages:', chat?.messages?.length || 0);

    if (chat && chat.messages.length === 0) {
      console.log('💬 No messages, will greet');
      setTimeout(() => {
        console.log('⏰ Greeting timeout fired');
        greet();
      }, 500);
    } else {
      console.log('✅ Messages exist, no greeting needed');
    }
  }

  // Enable contact modal after init (prevents flash on load)
  setTimeout(() => {
    contactModal?.classList.add('ready');
  }, 100);

  // Hide loading splash
  if (!authTransitionActive) {
    hideLoadingSplash();
  }

  console.log('✨ Init complete');
}

function hideLoadingSplash({ immediate = false, force = false } = {}) {
  if (!loadingSplash) return;
  if (authTransitionActive && !force && !immediate) return;
  if (loadingHideTimer) clearTimeout(loadingHideTimer);
  if (loadingRemoveTimer) clearTimeout(loadingRemoveTimer);

  const resetLoadingText = () => {
    if (loadingText) loadingText.textContent = LOADING_TEXT_DEFAULT;
  };

  if (immediate) {
    loadingSplash.classList.add('hidden');
    loadingSplash.style.pointerEvents = 'none';
    loadingSplash.style.display = 'none';
    resetLoadingText();
    return;
  }

  loadingHideTimer = setTimeout(() => {
    loadingSplash.classList.add('hidden');
    loadingRemoveTimer = setTimeout(() => {
      loadingSplash.style.display = 'none';
      loadingSplash.style.pointerEvents = 'none';
      resetLoadingText();
    }, 800);
  }, 300);
}

if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, waiting...');
  document.addEventListener('DOMContentLoaded', init);
} else {
  console.log('✅ DOM ready, running init immediately');
  init();
}

// ============================================================
// Contact Modal
// ============================================================

headerCenter?.addEventListener('click', () => {
  contactModal?.classList.add('active');
});

closeContactModal?.addEventListener('click', () => {
  contactModal?.classList.remove('active');
});

document.getElementById('contactModalInfoClose')?.addEventListener('click', () => {
  contactModal?.classList.remove('active');
});

messageContact?.addEventListener('click', () => {
  contactModal?.classList.remove('active');
  chatInput?.focus();
});

contactModal?.addEventListener('click', (e) => {
  if (e.target === contactModal) {
    contactModal.classList.remove('active');
  }
});

// ============================================================
// Theme System
// ============================================================

const THEME_KEY = 'imessage_theme';
const THEMES = ['light', 'dark', 'glass', 'gradient', 'midnight', 'sunset'];

function setTheme(theme) {
  // Add transitioning class for smooth animation
  document.body.classList.add('theme-transitioning');

  // Remove all theme classes and custom theme class
  THEMES.forEach(t => document.body.classList.remove(`theme-${t}`));
  document.body.classList.remove('theme-custom', 'style-solid', 'style-glass', 'style-gradient', 'style-neon');

  // Remove any custom bubble styles
  const customBubbleStyles = document.getElementById('custom-bubble-styles');
  if (customBubbleStyles) customBubbleStyles.remove();

  // Clear any inline styles from custom themes
  const elementsToReset = ['.sidebar', '.sidebar-header', '.imessage-header', '.chat-area', '.input-area', '.app-container'];
  elementsToReset.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) el.removeAttribute('style');
  });

  // Reset gradient background
  const gradientBg = document.getElementById('gradientBg');
  if (gradientBg) gradientBg.removeAttribute('style');

  // Add new theme class (light has no class)
  if (theme && theme !== 'light') {
    document.body.classList.add(`theme-${theme}`);
  }

  // Update theme picker buttons
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  // Save preference
  localStorage.setItem(THEME_KEY, theme);

  // Remove transitioning class after animation completes
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 450);

  // Add system message about theme change
  const chat = getChat();
  if (chat && state.currentChatId) {
    const themeNames = {
      'light': 'Light',
      'dark': 'Dark',
      'glass': 'Liquid Glass',
      'gradient': 'Gradient',
      'midnight': 'Midnight',
      'sunset': 'Sunset'
    };

    const themeName = themeNames[theme] || theme;
    const systemMsg = {
      type: 'received',
      text: `switched theme to ${themeName}`,
      timestamp: Date.now(),
      isSystem: true
    };

    chat.messages.push(systemMsg);
    chat.conversation.push({
      role: 'system',
      content: `User changed theme to ${themeName}`
    });

    addMessageToDOM(systemMsg, chat.messages.length - 1, true);
    saveState();
    scrollToBottom();
  }

  console.log('🎨 Theme set to:', theme);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  setTheme(saved);
}

// Theme picker click handlers
document.querySelectorAll('.theme-btn:not(.theme-btn-custom)').forEach(btn => {
  btn.addEventListener('click', () => {
    setTheme(btn.dataset.theme);
  });
});

// Load theme on init
loadTheme();

// ============================================================
// Theme Maker
// ============================================================

const themeMakerModal = document.getElementById('themeMakerModal');
const openThemeMakerBtn = document.getElementById('openThemeMaker');
const closeThemeMakerBtn = document.getElementById('closeThemeMaker');
const applyThemeBtn = document.getElementById('applyTheme');
const resetThemeBtn = document.getElementById('resetTheme');

// Theme maker state
let themeConfig = {
  style: 'solid',
  color: 'blue',
  customColor: '#007AFF',
  background: 'dark',
  glassIntensity: 60,
  blurAmount: 50,
  bubbleStyle: 'rounded',
  gradientDirection: 135,
  animations: {
    orbs: true,
    gradient: false,
    glow: false,
    pulse: true
  }
};

// Color palette
const colorPalette = {
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D92',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  teal: '#5AC8FA',
  cyan: '#00CED1',
  mint: '#00C7BE',
  indigo: '#5856D6',
  violet: '#8B5CF6',
  rose: '#EC4899',
  coral: '#FF7F50',
  gold: '#FFD700',
  lime: '#84CC16'
};

// Presets
const themePresets = {
  'ocean': { style: 'glass', color: 'blue', background: 'dark', bubbleStyle: 'rounded' },
  'forest': { style: 'solid', color: 'green', background: 'dark', bubbleStyle: 'rounded' },
  'sunset': { style: 'gradient', color: 'orange', customColor: '#FF6B6B', background: 'dark', bubbleStyle: 'cloud' },
  'midnight': { style: 'solid', color: 'indigo', background: 'amoled', bubbleStyle: 'rounded' },
  'cotton-candy': { style: 'glass', color: 'pink', background: 'dark', bubbleStyle: 'pill' },
  'aurora': { style: 'gradient', color: 'teal', background: 'dark', bubbleStyle: 'cloud', animations: { orbs: true, gradient: true, glow: true } },
  'fire': { style: 'neon', color: 'red', customColor: '#FF4500', background: 'amoled', bubbleStyle: 'rounded' },
  'ice': { style: 'glass', color: 'cyan', background: 'dark', bubbleStyle: 'pill' },
  'lavender': { style: 'solid', color: 'violet', background: 'dark', bubbleStyle: 'rounded' },
  'gold-rush': { style: 'neon', color: 'gold', customColor: '#FFD700', background: 'amoled', bubbleStyle: 'square' },
  'neon-city': { style: 'neon', color: 'pink', customColor: '#FF00FF', background: 'amoled', bubbleStyle: 'rounded' },
  'cherry': { style: 'glass', color: 'rose', background: 'dark', bubbleStyle: 'cloud' }
};

// Open theme maker
openThemeMakerBtn?.addEventListener('click', () => {
  themeMakerModal?.classList.add('active');
  contactModal?.classList.remove('active');
  updateThemePreview();
});

// Close theme maker
closeThemeMakerBtn?.addEventListener('click', () => {
  themeMakerModal?.classList.remove('active');
});

themeMakerModal?.addEventListener('click', (e) => {
  if (e.target === themeMakerModal) {
    themeMakerModal.classList.remove('active');
  }
});

// Style selection
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    themeConfig.style = btn.dataset.style;

    // Show/hide glass options
    const glassOptions = document.querySelectorAll('.glass-options');
    const gradientOptions = document.querySelectorAll('.gradient-options');

    glassOptions.forEach(el => {
      el.style.display = (themeConfig.style === 'glass') ? 'block' : 'none';
    });
    gradientOptions.forEach(el => {
      el.style.display = (themeConfig.style === 'gradient') ? 'block' : 'none';
    });

    updateThemePreview();
  });
});

// Color selection
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    themeConfig.color = btn.dataset.color;
    themeConfig.customColor = colorPalette[btn.dataset.color] || '#007AFF';
    document.getElementById('customAccentColor').value = themeConfig.customColor;
    updateThemePreview();
  });
});

// Custom color picker
document.getElementById('customAccentColor')?.addEventListener('input', (e) => {
  themeConfig.customColor = e.target.value;
  themeConfig.color = 'custom';
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  updateThemePreview();
});

// Background mode
document.querySelectorAll('.bg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    themeConfig.background = btn.dataset.bg;
    updateThemePreview();
  });
});

// Bubble style
document.querySelectorAll('.bubble-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    themeConfig.bubbleStyle = btn.dataset.bubble;
    updateThemePreview();
  });
});

// Gradient direction
document.querySelectorAll('.dir-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    themeConfig.gradientDirection = parseInt(btn.dataset.dir);
    updateThemePreview();
  });
});

// Sliders
document.getElementById('glassIntensity')?.addEventListener('input', (e) => {
  themeConfig.glassIntensity = parseInt(e.target.value);
  document.getElementById('glassIntensityValue').textContent = themeConfig.glassIntensity + '%';
  updateThemePreview();
});

document.getElementById('blurAmount')?.addEventListener('input', (e) => {
  themeConfig.blurAmount = parseInt(e.target.value);
  document.getElementById('blurAmountValue').textContent = themeConfig.blurAmount + 'px';
  updateThemePreview();
});

// Animation toggles
document.getElementById('animOrbs')?.addEventListener('change', (e) => {
  themeConfig.animations.orbs = e.target.checked;
  updateThemePreview();
});

document.getElementById('animGradient')?.addEventListener('change', (e) => {
  themeConfig.animations.gradient = e.target.checked;
  updateThemePreview();
});

document.getElementById('animGlow')?.addEventListener('change', (e) => {
  themeConfig.animations.glow = e.target.checked;
  updateThemePreview();
});

document.getElementById('animPulse')?.addEventListener('change', (e) => {
  themeConfig.animations.pulse = e.target.checked;
  updateThemePreview();
});

// Presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = themePresets[btn.dataset.preset];
    if (preset) {
      themeConfig = { ...themeConfig, ...preset };
      if (preset.animations) {
        themeConfig.animations = { ...themeConfig.animations, ...preset.animations };
      }

      // Update UI to reflect preset
      document.querySelectorAll('.style-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.style === themeConfig.style);
      });
      document.querySelectorAll('.color-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.color === themeConfig.color);
      });
      document.querySelectorAll('.bg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.bg === themeConfig.background);
      });
      document.querySelectorAll('.bubble-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.bubble === themeConfig.bubbleStyle);
      });

      if (themeConfig.customColor) {
        document.getElementById('customAccentColor').value = themeConfig.customColor;
      }

      // Update animation checkboxes
      document.getElementById('animOrbs').checked = themeConfig.animations.orbs;
      document.getElementById('animGradient').checked = themeConfig.animations.gradient;
      document.getElementById('animGlow').checked = themeConfig.animations.glow;
      document.getElementById('animPulse').checked = themeConfig.animations.pulse;

      updateThemePreview();
    }
  });
});

// Update preview
function updateThemePreview() {
  const previewBox = document.getElementById('themePreviewBox');
  if (!previewBox) return;

  const accent = themeConfig.customColor || colorPalette[themeConfig.color] || '#007AFF';

  // Background colors
  let bgColor, headerBg, chatBg, inputBg, receivedBg, textColor;

  switch (themeConfig.background) {
    case 'light':
      bgColor = '#ffffff';
      headerBg = 'rgba(255, 255, 255, 0.9)';
      chatBg = '#ffffff';
      inputBg = '#f6f6f6';
      receivedBg = '#e9e9eb';
      textColor = '#000000';
      break;
    case 'amoled':
      bgColor = '#000000';
      headerBg = 'rgba(0, 0, 0, 0.9)';
      chatBg = '#000000';
      inputBg = 'rgba(255, 255, 255, 0.05)';
      receivedBg = 'rgba(255, 255, 255, 0.1)';
      textColor = '#ffffff';
      break;
    default: // dark
      bgColor = '#1c1c1e';
      headerBg = 'rgba(28, 28, 30, 0.9)';
      chatBg = '#1c1c1e';
      inputBg = '#2c2c2e';
      receivedBg = '#3a3a3c';
      textColor = '#ffffff';
  }

  // Apply to preview
  previewBox.style.setProperty('--preview-bg', bgColor);
  previewBox.style.setProperty('--preview-header-bg', headerBg);
  previewBox.style.setProperty('--preview-chat-bg', chatBg);
  previewBox.style.setProperty('--preview-input-bg', inputBg);
  previewBox.style.setProperty('--preview-text', textColor);
  previewBox.style.setProperty('--preview-received-bg', receivedBg);
  previewBox.style.setProperty('--preview-received-text', textColor);

  // Sent bubble based on style
  let sentBg;
  switch (themeConfig.style) {
    case 'glass':
      sentBg = `rgba(${hexToRgb(accent)}, 0.25)`;
      break;
    case 'neon':
      sentBg = 'transparent';
      break;
    case 'gradient':
      sentBg = `linear-gradient(${themeConfig.gradientDirection}deg, ${accent} 0%, ${shiftHue(accent, 40)} 100%)`;
      break;
    default:
      sentBg = `linear-gradient(135deg, ${accent} 0%, ${shiftHue(accent, 30)} 100%)`;
  }

  previewBox.style.setProperty('--preview-sent-bg', sentBg);

  // Update preview bubbles border-radius
  const bubbles = previewBox.querySelectorAll('.preview-bubble');
  bubbles.forEach(bubble => {
    const isSent = bubble.classList.contains('sent');
    let radius;
    switch (themeConfig.bubbleStyle) {
      case 'pill':
        radius = '20px';
        break;
      case 'square':
        radius = '6px';
        break;
      case 'cloud':
        radius = isSent ? '22px 22px 6px 22px' : '22px 22px 22px 6px';
        break;
      default: // rounded
        radius = isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
    }
    bubble.style.borderRadius = radius;

    // Neon style
    if (themeConfig.style === 'neon') {
      if (isSent) {
        bubble.style.border = `2px solid ${accent}`;
        bubble.style.boxShadow = `0 0 15px ${accent}60, inset 0 0 10px ${accent}20`;
        bubble.style.background = 'rgba(0, 0, 0, 0.8)';
      } else {
        bubble.style.border = `1px solid ${accent}40`;
        bubble.style.boxShadow = 'none';
      }
    } else {
      bubble.style.border = 'none';
      bubble.style.boxShadow = 'none';
    }
  });
}

// Helper functions
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 122, 255';
}

function shiftHue(hex, amount) {
  let [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb((h + amount / 360) % 1, s, l);
  return `#${r2.toString(16).padStart(2, '0')}${g2.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Reset theme
resetThemeBtn?.addEventListener('click', () => {
  themeConfig = {
    style: 'solid',
    color: 'blue',
    customColor: '#007AFF',
    background: 'dark',
    glassIntensity: 60,
    blurAmount: 50,
    bubbleStyle: 'rounded',
    gradientDirection: 135,
    animations: { orbs: true, gradient: false, glow: false, pulse: true }
  };

  // Reset UI
  document.querySelectorAll('.style-btn').forEach(b => b.classList.toggle('active', b.dataset.style === 'solid'));
  document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('active', b.dataset.color === 'blue'));
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.toggle('active', b.dataset.bg === 'dark'));
  document.querySelectorAll('.bubble-btn').forEach(b => b.classList.toggle('active', b.dataset.bubble === 'rounded'));
  document.querySelectorAll('.dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === '135'));

  document.getElementById('customAccentColor').value = '#007AFF';
  document.getElementById('glassIntensity').value = 60;
  document.getElementById('glassIntensityValue').textContent = '60%';
  document.getElementById('blurAmount').value = 50;
  document.getElementById('blurAmountValue').textContent = '50px';
  document.getElementById('animOrbs').checked = true;
  document.getElementById('animGradient').checked = false;
  document.getElementById('animGlow').checked = false;
  document.getElementById('animPulse').checked = true;

  updateThemePreview();
});

// Apply custom theme
applyThemeBtn?.addEventListener('click', () => {
  applyCustomTheme(themeConfig);
  themeMakerModal?.classList.remove('active');

  // Save custom theme config
  localStorage.setItem('imessage_custom_theme', JSON.stringify(themeConfig));
});

function applyCustomTheme(config) {
  // Add transitioning class for smooth animation
  document.body.classList.add('theme-transitioning');

  const accent = config.customColor || colorPalette[config.color] || '#007AFF';
  const rgb = hexToRgb(accent);
  const accentDark = shiftHue(accent, 30);

  // Remove all theme classes
  document.body.classList.remove('theme-light', 'theme-dark', 'theme-glass', 'theme-gradient', 'theme-midnight', 'theme-sunset', 'theme-custom');
  document.body.classList.remove('style-solid', 'style-glass', 'style-gradient', 'style-neon');
  document.body.classList.remove('bubble-rounded', 'bubble-pill', 'bubble-square', 'bubble-cloud');
  document.body.classList.remove('anim-glow', 'anim-gradient');

  // Add custom theme class
  document.body.classList.add('theme-custom');

  // Remove transitioning class after animation completes
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 450);
  document.body.classList.add(`style-${config.style}`);
  document.body.classList.add(`bubble-${config.bubbleStyle}`);

  // Add animation classes
  if (config.animations.glow) document.body.classList.add('anim-glow');
  if (config.animations.gradient) document.body.classList.add('anim-gradient');

  // Set CSS custom properties
  document.documentElement.style.setProperty('--custom-accent', accent);
  document.documentElement.style.setProperty('--custom-accent-rgb', rgb);
  document.documentElement.style.setProperty('--custom-accent-dark', accentDark);

  // Get elements
  const sidebar = document.querySelector('.sidebar');
  const sidebarHeader = document.querySelector('.sidebar-header');
  const header = document.querySelector('.imessage-header');
  const chatAreaEl = document.querySelector('.chat-area');
  const inputArea = document.querySelector('.input-area');
  const appContainer = document.querySelector('.app-container');
  const gradientBg = document.getElementById('gradientBg');

  // Clear any inline styles first
  [sidebar, sidebarHeader, header, chatAreaEl, inputArea, appContainer].forEach(el => {
    if (el) el.removeAttribute('style');
  });

  // Background-specific base colors
  let bgBase, sidebarBg, headerBg, inputBg, receivedBg, textColor, separatorColor;

  switch (config.background) {
    case 'light':
      bgBase = '#ffffff';
      sidebarBg = '#f6f6f6';
      headerBg = 'rgba(255, 255, 255, 0.95)';
      inputBg = '#f6f6f6';
      receivedBg = '#e9e9eb';
      textColor = '#000000';
      separatorColor = 'rgba(60, 60, 67, 0.12)';
      break;
    case 'amoled':
      bgBase = '#000000';
      sidebarBg = '#000000';
      headerBg = 'rgba(0, 0, 0, 0.95)';
      inputBg = '#0a0a0a';
      receivedBg = '#1a1a1a';
      textColor = '#ffffff';
      separatorColor = 'rgba(255, 255, 255, 0.1)';
      break;
    default: // dark
      bgBase = '#1c1c1e';
      sidebarBg = '#1c1c1e';
      headerBg = 'rgba(28, 28, 30, 0.95)';
      inputBg = '#2c2c2e';
      receivedBg = '#3a3a3c';
      textColor = '#ffffff';
      separatorColor = 'rgba(255, 255, 255, 0.1)';
  }

  // Apply style-specific overrides
  if (config.style === 'glass') {
    // Glass style - translucent everything with accent tint
    const glassOpacity = config.glassIntensity / 100;
    const blur = config.blurAmount;

    // Create color-tinted glass backgrounds
    const glassBg = `rgba(${rgb}, ${0.05 * glassOpacity})`;
    const glassSidebar = `rgba(${rgb}, ${0.08 * glassOpacity})`;
    const glassHeader = `rgba(${rgb}, ${0.1 * glassOpacity})`;

    if (gradientBg) {
      gradientBg.style.background = `linear-gradient(135deg, #0c1929 0%, rgba(${rgb}, 0.15) 50%, #0d1f35 100%)`;
      gradientBg.style.backgroundSize = '200% 200%';
    }

    if (appContainer) {
      appContainer.style.background = glassBg;
      appContainer.style.backdropFilter = `blur(${blur}px) saturate(130%)`;
      appContainer.style.webkitBackdropFilter = `blur(${blur}px) saturate(130%)`;
      appContainer.style.border = `1px solid rgba(${rgb}, 0.2)`;
    }

    if (sidebar) {
      sidebar.style.background = glassSidebar;
      sidebar.style.backdropFilter = `blur(${blur * 0.8}px) saturate(120%)`;
      sidebar.style.webkitBackdropFilter = `blur(${blur * 0.8}px) saturate(120%)`;
      sidebar.style.borderRight = `1px solid rgba(${rgb}, 0.15)`;
    }

    if (sidebarHeader) {
      sidebarHeader.style.background = glassHeader;
      sidebarHeader.style.backdropFilter = `blur(${blur * 0.6}px)`;
      sidebarHeader.style.webkitBackdropFilter = `blur(${blur * 0.6}px)`;
    }

    if (header) {
      header.style.background = glassHeader;
      header.style.backdropFilter = `blur(${blur}px) saturate(120%)`;
      header.style.webkitBackdropFilter = `blur(${blur}px) saturate(120%)`;
      header.style.borderBottom = `1px solid rgba(${rgb}, 0.1)`;
    }

    if (chatAreaEl) {
      chatAreaEl.style.background = 'transparent';
    }

    if (inputArea) {
      inputArea.style.background = glassSidebar;
      inputArea.style.backdropFilter = `blur(${blur * 0.8}px) saturate(120%)`;
      inputArea.style.webkitBackdropFilter = `blur(${blur * 0.8}px) saturate(120%)`;
      inputArea.style.borderTop = `1px solid rgba(${rgb}, 0.1)`;
    }

    // Set CSS vars for glass mode
    document.documentElement.style.setProperty('--imessage-bg', 'transparent');
    document.documentElement.style.setProperty('--imessage-sidebar-bg', glassSidebar);
    document.documentElement.style.setProperty('--imessage-header-bg', glassHeader);
    document.documentElement.style.setProperty('--imessage-input-bg', `rgba(${rgb}, 0.1)`);
    document.documentElement.style.setProperty('--imessage-gray', `rgba(255, 255, 255, 0.12)`);
    document.documentElement.style.setProperty('--text-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.7)');
    document.documentElement.style.setProperty('--separator', `rgba(${rgb}, 0.15)`);

  } else if (config.style === 'gradient') {
    if (gradientBg) {
      gradientBg.style.background = `linear-gradient(${config.gradientDirection}deg, #0a0a0f 0%, rgba(${rgb}, 0.3) 50%, #0a0a0f 100%)`;
    }

    if (appContainer) {
      appContainer.style.background = 'rgba(0, 0, 0, 0.4)';
      appContainer.style.backdropFilter = 'blur(20px)';
      appContainer.style.webkitBackdropFilter = 'blur(20px)';
    }

    if (sidebar) {
      sidebar.style.background = 'rgba(0, 0, 0, 0.5)';
    }

    if (sidebarHeader) {
      sidebarHeader.style.background = 'rgba(0, 0, 0, 0.3)';
    }

    if (header) {
      header.style.background = 'rgba(0, 0, 0, 0.4)';
      header.style.borderBottom = `1px solid rgba(${rgb}, 0.2)`;
    }

    if (chatAreaEl) {
      chatAreaEl.style.background = 'transparent';
    }

    if (inputArea) {
      inputArea.style.background = 'rgba(0, 0, 0, 0.4)';
      inputArea.style.borderTop = `1px solid rgba(${rgb}, 0.2)`;
    }

    document.documentElement.style.setProperty('--imessage-bg', 'transparent');
    document.documentElement.style.setProperty('--imessage-sidebar-bg', 'rgba(0, 0, 0, 0.5)');
    document.documentElement.style.setProperty('--imessage-input-bg', `rgba(${rgb}, 0.15)`);
    document.documentElement.style.setProperty('--imessage-gray', 'rgba(255, 255, 255, 0.15)');
    document.documentElement.style.setProperty('--text-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.7)');
    document.documentElement.style.setProperty('--separator', `rgba(${rgb}, 0.2)`);

  } else if (config.style === 'neon') {
    if (gradientBg) {
      gradientBg.style.background = '#0a0a0f';
    }

    if (appContainer) {
      appContainer.style.background = '#0a0a0a';
      appContainer.style.boxShadow = `0 0 60px rgba(${rgb}, 0.3), inset 0 0 30px rgba(${rgb}, 0.05)`;
      appContainer.style.border = `1px solid rgba(${rgb}, 0.3)`;
    }

    if (sidebar) {
      sidebar.style.background = '#0a0a0a';
      sidebar.style.borderRight = `1px solid rgba(${rgb}, 0.3)`;
    }

    if (sidebarHeader) {
      sidebarHeader.style.background = '#0a0a0a';
      sidebarHeader.style.borderBottom = `1px solid rgba(${rgb}, 0.2)`;
    }

    if (header) {
      header.style.background = '#0a0a0a';
      header.style.borderBottom = `2px solid rgba(${rgb}, 0.5)`;
      header.style.boxShadow = `0 2px 20px rgba(${rgb}, 0.2)`;
    }

    if (chatAreaEl) {
      chatAreaEl.style.background = '#0a0a0a';
    }

    if (inputArea) {
      inputArea.style.background = '#0a0a0a';
      inputArea.style.borderTop = `1px solid rgba(${rgb}, 0.3)`;
    }

    document.documentElement.style.setProperty('--imessage-bg', '#0a0a0a');
    document.documentElement.style.setProperty('--imessage-sidebar-bg', '#0a0a0a');
    document.documentElement.style.setProperty('--imessage-input-bg', '#111111');
    document.documentElement.style.setProperty('--imessage-gray', '#1a1a1a');
    document.documentElement.style.setProperty('--text-primary', '#ffffff');
    document.documentElement.style.setProperty('--text-secondary', accent);
    document.documentElement.style.setProperty('--separator', `rgba(${rgb}, 0.3)`);

  } else {
    // Solid style
    if (gradientBg) {
      const bgGradient = config.background === 'light'
        ? `linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)`
        : `linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)`;
      gradientBg.style.background = bgGradient;
    }

    if (sidebar) {
      sidebar.style.background = sidebarBg;
    }

    if (sidebarHeader) {
      sidebarHeader.style.background = headerBg;
    }

    if (header) {
      header.style.background = headerBg;
    }

    if (chatAreaEl) {
      chatAreaEl.style.background = bgBase;
    }

    if (inputArea) {
      inputArea.style.background = bgBase;
    }

    if (appContainer) {
      appContainer.style.background = bgBase;
    }

    document.documentElement.style.setProperty('--imessage-bg', bgBase);
    document.documentElement.style.setProperty('--imessage-sidebar-bg', sidebarBg);
    document.documentElement.style.setProperty('--imessage-input-bg', inputBg);
    document.documentElement.style.setProperty('--imessage-gray', receivedBg);
    document.documentElement.style.setProperty('--text-primary', textColor);
    document.documentElement.style.setProperty('--text-secondary', '#8e8e93');
    document.documentElement.style.setProperty('--separator', separatorColor);
  }

  // Handle orb visibility and color
  const orbs = document.querySelectorAll('.gradient-orb');
  orbs.forEach((orb, i) => {
    if (config.animations.orbs) {
      orb.style.opacity = '';
      // Tint orbs with accent color
      if (i === 0) orb.style.background = `radial-gradient(circle, rgba(${rgb}, 0.7) 0%, transparent 70%)`;
      if (i === 1) orb.style.background = `radial-gradient(circle, rgba(${rgb}, 0.5) 0%, transparent 70%)`;
      if (i === 2) orb.style.background = `radial-gradient(circle, rgba(${rgb}, 0.4) 0%, transparent 70%)`;
    } else {
      orb.style.opacity = '0';
    }
  });

  // Apply bubble styles via CSS injection
  let bubbleStyleSheet = document.getElementById('custom-bubble-styles');
  if (!bubbleStyleSheet) {
    bubbleStyleSheet = document.createElement('style');
    bubbleStyleSheet.id = 'custom-bubble-styles';
    document.head.appendChild(bubbleStyleSheet);
  }

  // Build bubble CSS based on style
  let bubbleCSS = '';

  if (config.style === 'glass') {
    bubbleCSS = `
      body.theme-custom.style-glass .bubble.sent {
        background: rgba(${rgb}, 0.25) !important;
        backdrop-filter: blur(30px) saturate(130%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(130%) !important;
        border: 1px solid rgba(${rgb}, 0.35) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.15) !important;
        color: #fff !important;
      }
      body.theme-custom.style-glass .bubble.received {
        background: rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(30px) saturate(130%) !important;
        -webkit-backdrop-filter: blur(30px) saturate(130%) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        color: #fff !important;
      }
    `;
  } else if (config.style === 'neon') {
    bubbleCSS = `
      body.theme-custom.style-neon .bubble.sent {
        background: rgba(0, 0, 0, 0.8) !important;
        border: 2px solid ${accent} !important;
        box-shadow: 0 0 20px rgba(${rgb}, 0.5), inset 0 0 15px rgba(${rgb}, 0.15) !important;
        color: #fff !important;
      }
      body.theme-custom.style-neon .bubble.received {
        background: rgba(0, 0, 0, 0.6) !important;
        border: 1px solid rgba(${rgb}, 0.4) !important;
        color: #fff !important;
      }
    `;
  } else if (config.style === 'gradient') {
    bubbleCSS = `
      body.theme-custom.style-gradient .bubble.sent {
        background: linear-gradient(${config.gradientDirection}deg, ${accent} 0%, ${accentDark} 100%) !important;
        color: #fff !important;
        box-shadow: 0 2px 8px rgba(${rgb}, 0.3) !important;
      }
      body.theme-custom.style-gradient .bubble.received {
        background: rgba(255, 255, 255, 0.15) !important;
        color: #fff !important;
      }
    `;
  } else {
    // Solid
    bubbleCSS = `
      body.theme-custom.style-solid .bubble.sent {
        background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%) !important;
        color: #fff !important;
        box-shadow: 0 2px 8px rgba(${rgb}, 0.3) !important;
      }
      body.theme-custom.style-solid .bubble.received {
        background: ${receivedBg} !important;
        color: ${textColor} !important;
      }
    `;
  }

  // Bubble shape styles
  const radiusMap = {
    rounded: { sent: '18px 18px 4px 18px', received: '18px 18px 18px 4px' },
    pill: { sent: '20px', received: '20px' },
    square: { sent: '6px', received: '6px' },
    cloud: { sent: '22px 22px 6px 22px', received: '22px 22px 22px 6px' }
  };
  const radii = radiusMap[config.bubbleStyle] || radiusMap.rounded;

  bubbleCSS += `
    body.theme-custom .bubble.sent { border-radius: ${radii.sent} !important; }
    body.theme-custom .bubble.received { border-radius: ${radii.received} !important; }
  `;

  // Send button and accents
  bubbleCSS += `
    body.theme-custom .send-button {
      background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%) !important;
    }
    body.theme-custom .new-chat-btn {
      background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%) !important;
    }
    body.theme-custom .chat-item.active {
      box-shadow: inset 3px 0 0 ${accent} !important;
    }
    body.theme-custom .input-field-container:focus-within {
      border-color: rgba(${rgb}, 0.5) !important;
      box-shadow: 0 0 0 3px rgba(${rgb}, 0.15) !important;
    }
  `;

  bubbleStyleSheet.textContent = bubbleCSS;

  // Update theme buttons in modal
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Save to localStorage
  localStorage.setItem(THEME_KEY, 'custom');

  // Add system message
  const chat = getChat();
  if (chat && state.currentChatId) {
    const styleName = config.style.charAt(0).toUpperCase() + config.style.slice(1);
    const colorName = config.color.charAt(0).toUpperCase() + config.color.slice(1);
    const systemMsg = {
      type: 'received',
      text: `created custom ${styleName} theme with ${colorName} accent`,
      timestamp: Date.now(),
      isSystem: true
    };
    chat.messages.push(systemMsg);
    addMessageToDOM(systemMsg, chat.messages.length - 1, true);
    saveState();
    scrollToBottom();
  }

  console.log('🎨 Custom theme applied:', config);
}

// Load custom theme on init if saved
function loadCustomTheme() {
  const saved = localStorage.getItem('imessage_custom_theme');
  if (saved && localStorage.getItem(THEME_KEY) === 'custom') {
    try {
      themeConfig = JSON.parse(saved);
      applyCustomTheme(themeConfig);
    } catch (e) {
      console.error('Failed to load custom theme:', e);
    }
  }
}

// Call after loadTheme
loadCustomTheme();

// ============================================================
// Smooth Chat Switching (Animation Fix)
// ============================================================

function switchChatSmooth(id) {
  if (!state.chats[id]) return;
  if (id === state.currentChatId) return;

  // Fade out current chat
  chatArea?.classList.add('switching');

  setTimeout(() => {
    state.currentChatId = id;
    saveState();
    renderChatList();
    renderMessages();

    // Fade back in
    setTimeout(() => {
      chatArea?.classList.remove('switching');
    }, 50);
  }, 150);
}

// Override the original switchChat to use smooth version
const originalSwitchChat = switchChat;
switchChat = switchChatSmooth;


// ============================================================
// Smooth Typing Indicator (Animation Fix)
// ============================================================

const originalHideTyping = hideTyping;
hideTyping = function() {
  const typing = document.getElementById('typing');
  if (typing) {
    typing.classList.add('hiding');
    setTimeout(() => {
      typing.remove();
    }, 200);
  }
};

// ============================================================
// Prevent Long Messages (300 char limit)
// ============================================================

chatInput?.addEventListener('keydown', (e) => {
  if (chatInput.value.length >= 300 && e.key !== 'Backspace' && e.key !== 'Delete' && !e.ctrlKey && !e.metaKey) {
    if (e.key.length === 1) {
      e.preventDefault();
    }
  }
});

// ============================================================
// Mobile Viewport Height Fix
// ============================================================

function setMobileViewportHeight() {
  // Fix for mobile browsers where 100vh doesn't account for address bar
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

// Set on load and resize
setMobileViewportHeight();
window.addEventListener('resize', setMobileViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(setMobileViewportHeight, 100);
});

// Also fix when virtual keyboard shows/hides on mobile
if ('visualViewport' in window) {
  window.visualViewport.addEventListener('resize', setMobileViewportHeight);
}

// ============================================================
// QoL: Double-tap message to react
// ============================================================

let lastTapTime = 0;
let lastTapTarget = null;

chatArea?.addEventListener('click', (e) => {
  const bubble = e.target.closest('.bubble');
  if (!bubble) return;

  const currentTime = Date.now();
  const wrapper = bubble.closest('.message-wrapper');

  if (lastTapTarget === bubble && currentTime - lastTapTime < 300) {
    // Double tap detected - add quick reaction
    const idx = parseInt(wrapper?.dataset.idx);
    if (!isNaN(idx)) {
      const chat = getChat();
      const msg = chat?.messages[idx];
      if (msg && msg.type === 'received') {
        // Toggle heart reaction on received messages
        msg.reaction = msg.reaction === '❤️' ? null : '❤️';
        saveState();

        // Update DOM
        let reactionEl = wrapper.querySelector('.reaction');
        if (msg.reaction) {
          if (!reactionEl) {
            reactionEl = document.createElement('div');
            reactionEl.className = 'reaction received';
            wrapper.querySelector('.bubble-container')?.appendChild(reactionEl);
          }
          reactionEl.textContent = msg.reaction;
        } else if (reactionEl) {
          reactionEl.remove();
        }
      }
    }
    lastTapTime = 0;
    lastTapTarget = null;
  } else {
    lastTapTime = currentTime;
    lastTapTarget = bubble;
  }
});

// ============================================================
// QoL: Swipe down to close search
// ============================================================

let touchStartY = 0;
searchBar?.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
});

searchBar?.addEventListener('touchend', (e) => {
  const touchEndY = e.changedTouches[0].clientY;
  if (touchEndY - touchStartY > 50) {
    clearSearch();
  }
});

// ============================================================
// QoL: Haptic feedback on send (if supported)
// ============================================================

const originalSendMessage = sendMessage;
sendMessage = async function() {
  // Trigger haptic feedback if available
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
  return originalSendMessage.apply(this, arguments);
};

// ============================================================
// QoL: Auto-scroll pause when user scrolls up
// ============================================================

let userScrolledUp = false;
let scrollTimeout;
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');

chatArea?.addEventListener('scroll', () => {
  const isAtBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < 100;
  userScrolledUp = !isAtBottom;

  // Show "scroll to bottom" button when scrolled up
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (scrollToBottomBtn) {
      scrollToBottomBtn.classList.toggle('visible', userScrolledUp);
    }
  }, 150);
});

// Scroll to bottom button click handler
scrollToBottomBtn?.addEventListener('click', () => {
  userScrolledUp = false;
  scrollToBottomBtn.classList.remove('visible');
  if (chatArea) {
    chatArea.scrollTo({
      top: chatArea.scrollHeight,
      behavior: 'smooth'
    });
  }
});

// Override scrollToBottom to respect user scroll position
const originalScrollToBottom = scrollToBottom;
scrollToBottom = function() {
  if (!userScrolledUp) {
    originalScrollToBottom.apply(this, arguments);
  }
};

// ============================================================
// Code Sandbox - Run JavaScript/HTML in isolation
// ============================================================

function createCodeSandbox(code, language = 'javascript') {
  const container = document.createElement('div');
  container.className = 'code-sandbox-container';

  const header = document.createElement('div');
  header.className = 'code-sandbox-header';

  const langLabel = document.createElement('span');
  langLabel.className = 'code-sandbox-lang';
  langLabel.textContent = language;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'code-sandbox-run';
  copyBtn.textContent = '📋 Copy';
  copyBtn.style.background = '#5AC8FA';

  header.appendChild(langLabel);
  header.appendChild(copyBtn);

  const codeBlock = document.createElement('pre');
  codeBlock.className = 'code-sandbox-code';
  codeBlock.textContent = code;

  const output = document.createElement('div');
  output.className = 'code-sandbox-output';
  output.textContent = 'running...';

  container.appendChild(header);
  container.appendChild(codeBlock);
  container.appendChild(output);

  // Copy button functionality
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(code).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    });
  });

  // Auto-run the code immediately (AI runs it, not user)
  runSandboxCode(code, language, output, null);

  return container;
}

function runSandboxCode(code, language, outputEl, runBtn) {
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running...';
  }
  outputEl.textContent = '';
  outputEl.className = 'code-sandbox-output';

  const logs = [];

  try {
    if (language === 'javascript' || language === 'js') {
      // Create sandboxed console
      const sandboxConsole = {
        log: (...args) => logs.push(args.map(formatOutput).join(' ')),
        error: (...args) => logs.push('❌ ' + args.map(formatOutput).join(' ')),
        warn: (...args) => logs.push('⚠️ ' + args.map(formatOutput).join(' ')),
        info: (...args) => logs.push('ℹ️ ' + args.map(formatOutput).join(' ')),
        table: (data) => logs.push(JSON.stringify(data, null, 2))
      };

      // Run in isolated function scope
      const sandboxFn = new Function('console', `
        "use strict";
        try {
          ${code}
        } catch (e) {
          console.error(e.message);
        }
      `);

      const result = sandboxFn(sandboxConsole);

      if (logs.length > 0) {
        outputEl.textContent = logs.join('\n');
        outputEl.classList.add('success');
      } else if (result !== undefined) {
        outputEl.textContent = formatOutput(result);
        outputEl.classList.add('success');
      } else {
        outputEl.textContent = '✓ Executed (no output)';
        outputEl.classList.add('success');
      }

    } else if (language === 'html') {
      // Create iframe for HTML sandbox
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width: 100%; height: 200px; border: none; background: #fff; border-radius: 8px;';
      iframe.sandbox = 'allow-scripts';

      outputEl.innerHTML = '';
      outputEl.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(code);
      iframeDoc.close();

      outputEl.classList.add('success');

    } else if (language === 'css') {
      // Show CSS preview
      const preview = document.createElement('div');
      preview.style.cssText = 'padding: 16px; background: #fff; border-radius: 8px;';
      preview.innerHTML = `<style>${code}</style><div class="preview-target">CSS Preview Applied</div>`;

      outputEl.innerHTML = '';
      outputEl.appendChild(preview);
      outputEl.classList.add('success');

    } else {
      outputEl.textContent = `Language "${language}" not supported for execution. Supported: javascript, html, css`;
      outputEl.classList.add('error');
    }

  } catch (error) {
    outputEl.textContent = '❌ Error: ' + error.message;
    outputEl.classList.add('error');
  }

  if (runBtn) {
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run';
  }
}

function formatOutput(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

// Parse code blocks from AI response and make them runnable
function processCodeBlocks(text) {
  // Match ```language\ncode\n``` pattern
  const codeBlockRegex = /```(javascript|js|html|css)\n([\s\S]*?)```/gi;

  let result = text;
  let match;
  const sandboxes = [];

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1].toLowerCase();
    const code = match[2].trim();
    const placeholder = `__SANDBOX_${sandboxes.length}__`;

    sandboxes.push({ code, language, placeholder, original: match[0] });
    result = result.replace(match[0], placeholder);
  }

  return { text: result, sandboxes };
}

// Modify message display to include code sandboxes
function enhanceMessageWithSandboxes(messageEl, text) {
  const { sandboxes } = processCodeBlocks(text);

  if (sandboxes.length === 0) return;

  // Replace placeholders with sandbox containers
  sandboxes.forEach(({ code, language, placeholder }) => {
    const sandbox = createCodeSandbox(code, language);
    const textNode = messageEl.querySelector('.bubble-text, .message-text');

    if (textNode) {
      const html = textNode.innerHTML;
      if (html.includes(placeholder)) {
        const parts = html.split(placeholder);
        textNode.innerHTML = parts[0];
        textNode.appendChild(sandbox);
        if (parts[1]) {
          const remaining = document.createElement('span');
          remaining.innerHTML = parts[1];
          textNode.appendChild(remaining);
        }
      } else {
        // Just append at end if placeholder not found
        textNode.appendChild(sandbox);
      }
    }
  });
}
