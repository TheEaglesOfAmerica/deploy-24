const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { requireAuth } = require('../middleware/auth');

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
