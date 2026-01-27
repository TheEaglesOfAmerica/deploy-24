// Auth middleware - verifies Supabase JWT
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const supabase = req.app.locals.supabase;

    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

// Optional auth - doesn't fail if no token, just sets req.user if valid
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const supabase = req.app.locals.supabase;

    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
    next();
  } catch (err) {
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
