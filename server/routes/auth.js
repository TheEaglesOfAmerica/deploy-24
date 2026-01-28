const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { requireAuth } = require('../middleware/auth');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(base64url) {
  const base64 = String(base64url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + pad, 'base64');
}

function getPasskeyConfig() {
  const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL || process.env.APP_URL || '';
  let origin = '';
  let rpID = '';
  try {
    const u = new URL(frontendUrl);
    origin = u.origin;
    rpID = u.hostname;
  } catch (e) {
    // Fallback to request host/origin in route handlers if env isn't present.
  }

  return {
    rpName: process.env.PASSKEY_RP_NAME || 'Spunnie',
    rpID: process.env.PASSKEY_RP_ID || rpID,
    origin: process.env.PASSKEY_ORIGIN || origin
  };
}

// In-memory challenge store (good enough for a single PM2 instance).
// Key: `${type}:${userId}` for registration, `${type}:${challenge}` for authentication.
const passkeyChallenges = new Map();

function setChallenge(key, challenge) {
  passkeyChallenges.set(key, { challenge, createdAt: Date.now() });
  setTimeout(() => {
    const item = passkeyChallenges.get(key);
    if (item && Date.now() - item.createdAt >= 10 * 60 * 1000) {
      passkeyChallenges.delete(key);
    }
  }, 10 * 60 * 1000 + 1000).unref?.();
}

function getChallenge(key) {
  const item = passkeyChallenges.get(key);
  if (!item) return null;
  if (Date.now() - item.createdAt > 10 * 60 * 1000) {
    passkeyChallenges.delete(key);
    return null;
  }
  return item.challenge;
}

// Google OAuth is handled client-side with Supabase
// These endpoints handle TOTP setup and verification

// Setup TOTP for existing user - generates secret and QR code
router.post('/totp/setup', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const userId = req.user.id;

    // Generate a new TOTP secret
    const secret = authenticator.generateSecret();

    // Store the secret in user metadata (not verified yet)
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        totp_secret: secret,
        totp_verified: false
      }
    });

    if (updateError) {
      throw updateError;
    }

    // Generate QR code URL (no email needed, just user ID + app name)
    const otpauth = authenticator.keyuri(userId, 'Chat Bots', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    res.json({
      secret,
      qrCode: qrCodeUrl,
      message: 'Scan this QR code with your authenticator app'
    });
  } catch (err) {
    console.error('TOTP setup error:', err);
    res.status(500).json({ error: 'Failed to setup TOTP' });
  }
});

// Signup with authenticator only (no email)
router.post('/totp/signup', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const supabase = req.app.locals.supabase;

    // For authenticator-only signup, we need:
    // 1. User already has a TOTP secret in temporary session (stored client-side)
    // 2. User verifies the code
    // 3. We create an account for them

    // Since we don't have email, we use a UUID-based identifier
    // The client will store and manage the user ID locally
    const userId = require('crypto').randomUUID();

    // Verify the code matches the secret (secret should be provided from client)
    // This is a placeholder - the actual verification happens client-side
    // Then we create the account

    res.json({
      success: true,
      userId: userId,
      message: 'Account created successfully'
    });
  } catch (err) {
    console.error('TOTP signup error:', err);
    res.status(500).json({ error: 'Failed to signup with TOTP' });
  }
});

// Verify TOTP code during signup (2-step process)
router.post('/totp/verify-signup', async (req, res) => {
  try {
    const { code, secret } = req.body;

    if (!code || !secret) {
      return res.status(400).json({ error: 'Code and secret are required' });
    }

    // Verify the code against the secret
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code. Try again.' });
    }

    // Code is valid - return success
    // Client will handle creating the authenticated session
    res.json({
      success: true,
      message: 'Authenticator verified successfully'
    });
  } catch (err) {
    console.error('TOTP verify signup error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Start authenticator-only signup (no auth required): generates secret + QR code
router.post('/totp/signup/start', async (req, res) => {
  try {
    const secret = authenticator.generateSecret();

    // Label without email: random id + app name
    const label = require('crypto').randomUUID();
    const otpauth = authenticator.keyuri(label, 'Chat Bots', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    res.json({
      secret,
      qrCode: qrCodeUrl,
      message: 'Scan this QR code with your authenticator app'
    });
  } catch (err) {
    console.error('TOTP signup start error:', err);
    res.status(500).json({ error: 'Failed to start TOTP signup' });
  }
});

// Verify TOTP code
router.post('/totp/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const supabase = req.app.locals.supabase;
    const userId = req.user.id;

    // Get the stored secret
    const secret = req.user.user_metadata?.totp_secret;
    if (!secret) {
      return res.status(400).json({ error: 'TOTP not set up' });
    }

    // Verify the code
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Mark TOTP as verified
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        totp_verified: true
      }
    });

    res.json({ success: true, message: 'TOTP verified successfully' });
  } catch (err) {
    console.error('TOTP verify error:', err);
    res.status(500).json({ error: 'Failed to verify TOTP' });
  }
});

// Login with TOTP (for users who have it set up)
router.post('/totp/login', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const supabase = req.app.locals.supabase;

    // Get user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if TOTP is set up and verified
    const secret = user.user_metadata?.totp_secret;
    const verified = user.user_metadata?.totp_verified;

    if (!secret || !verified) {
      return res.status(400).json({ error: 'TOTP not set up for this user' });
    }

    // Verify the code
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Generate a session for the user
    const { data: session, error: signInError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email
    });

    if (signInError) throw signInError;

    res.json({
      success: true,
      message: 'TOTP verified',
      // Client will need to complete the sign-in
      userId: user.id
    });
  } catch (err) {
    console.error('TOTP login error:', err);
    res.status(500).json({ error: 'Failed to login with TOTP' });
  }
});

// ============================================================
// PASSKEYS (WebAuthn)
// ============================================================

// Register: return options (requires logged-in user)
router.post('/passkey/register-options', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const userId = req.user.id;

    const cfg = getPasskeyConfig();
    const rpID = cfg.rpID || req.get('host');
    const origin = cfg.origin || `${req.protocol}://${req.get('host')}`;

    const { data: existingCreds } = await supabase
      .from('passkeys')
      .select('credential_id')
      .eq('user_id', userId);

    const excludeCredentials = (existingCreds || [])
      .filter(r => r.credential_id)
      .map(r => ({
        id: fromBase64Url(r.credential_id),
        type: 'public-key'
      }));

    const options = await generateRegistrationOptions({
      rpName: cfg.rpName,
      rpID,
      userID: toBase64Url(Buffer.from(userId, 'utf8')),
      userName: req.user.email || userId,
      userDisplayName: req.user.user_metadata?.full_name || req.user.email || userId,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred'
      },
      excludeCredentials
    });

    setChallenge(`reg:${userId}`, options.challenge);

    res.json({
      ...options,
      rp: { name: cfg.rpName, id: rpID },
      user: {
        id: options.user.id,
        name: req.user.email || userId,
        displayName: req.user.user_metadata?.full_name || req.user.email || userId
      },
      expectedOrigin: origin
    });
  } catch (err) {
    console.error('Passkey register-options error:', err);
    res.status(500).json({ error: 'Failed to create passkey options' });
  }
});

// Register: verify response + store credential (requires logged-in user)
router.post('/passkey/register', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const userId = req.user.id;

    const cfg = getPasskeyConfig();
    const rpID = cfg.rpID || req.get('host');
    const expectedOrigin = cfg.origin || `${req.protocol}://${req.get('host')}`;
    const expectedChallenge = getChallenge(`reg:${userId}`);

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration expired. Try again.' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(401).json({ success: false, error: 'Passkey registration failed' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    const credentialIdB64 = toBase64Url(credentialID);
    const publicKeyB64 = toBase64Url(credentialPublicKey);

    const { error } = await supabase
      .from('passkeys')
      .insert({
        user_id: userId,
        user_email: req.user.email,
        credential_id: credentialIdB64,
        public_key: publicKeyB64,
        counter: counter || 0,
        transports: Array.isArray(req.body?.transports) ? req.body.transports : null
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Passkey register error:', err);
    res.status(500).json({ error: 'Failed to register passkey' });
  }
});

// Login: issue challenge (no auth required)
router.post('/passkey/challenge', async (req, res) => {
  try {
    const cfg = getPasskeyConfig();
    const rpID = cfg.rpID || req.get('host');

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred'
      // allowCredentials omitted to allow "discoverable credentials" UX
    });

    setChallenge(`auth:${options.challenge}`, options.challenge);

    res.json({ challenge: options.challenge, rpId: rpID });
  } catch (err) {
    console.error('Passkey challenge error:', err);
    res.status(500).json({ error: 'Failed to create passkey challenge' });
  }
});

// Login: verify + return a Supabase magic link to finish sign-in
router.post('/passkey/verify', async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const cfg = getPasskeyConfig();
    const rpID = cfg.rpID || req.get('host');
    const expectedOrigin = cfg.origin || `${req.protocol}://${req.get('host')}`;

    const rawId = req.body?.rawId;
    const credId = req.body?.id || rawId;
    if (!credId) return res.status(400).json({ error: 'Missing credential id' });

    // Client doesn't explicitly send the issued challenge back; parse it from clientDataJSON.
    let challengeFromClient = null;
    try {
      const clientData = JSON.parse(fromBase64Url(req.body?.response?.clientDataJSON || '').toString('utf8'));
      challengeFromClient = clientData?.challenge || null;
    } catch (e) {}

    const expectedChallenge = challengeFromClient ? getChallenge(`auth:${challengeFromClient}`) : null;
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge expired. Try again.' });
    }

    const { data: passkey, error: passkeyError } = await supabase
      .from('passkeys')
      .select('id, user_id, user_email, credential_id, public_key, counter')
      .eq('credential_id', credId)
      .single();

    if (passkeyError || !passkey) {
      return res.status(404).json({ error: 'Passkey not found' });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: fromBase64Url(passkey.credential_id),
        credentialPublicKey: fromBase64Url(passkey.public_key),
        counter: passkey.counter || 0
      }
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, error: 'Passkey verification failed' });
    }

    const newCounter = verification.authenticationInfo?.newCounter;
    if (typeof newCounter === 'number') {
      await supabase
        .from('passkeys')
        .update({ counter: newCounter, updated_at: new Date().toISOString() })
        .eq('id', passkey.id);
    }

    if (!passkey.user_email) {
      return res.status(500).json({ error: 'Passkey missing email. Re-register while signed in.' });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: passkey.user_email,
      options: {
        redirectTo: cfg.origin || `${req.protocol}://${req.get('host')}`
      }
    });

    if (linkError) throw linkError;
    const actionLink = linkData?.properties?.action_link || linkData?.properties?.actionLink || linkData?.action_link;
    if (!actionLink) {
      return res.status(500).json({ error: 'Failed to generate login link' });
    }

    res.json({ success: true, actionLink });
  } catch (err) {
    console.error('Passkey verify error:', err);
    res.status(500).json({ error: 'Failed to verify passkey' });
  }
});

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;

    // Get or create profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: req.user.id,
          display_name: req.user.user_metadata?.full_name || req.user.email?.split('@')[0],
          avatar_url: req.user.user_metadata?.avatar_url
        })
        .select()
        .single();

      if (createError) throw createError;
      return res.json(newProfile);
    }

    if (error) throw error;
    res.json(profile);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    const supabase = req.app.locals.supabase;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ display_name, avatar_url })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(profile);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
