const buckets = new Map();

function rateLimit({ key, limit, windowMs }) {
  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const bucketKey = `${key}:${userId}`;
    const now = Date.now();
    const entry = buckets.get(bucketKey) || { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

    if (entry.timestamps.length >= limit) {
      const oldest = entry.timestamps[0];
      const retryAfterMs = Math.max(0, windowMs - (now - oldest));
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      buckets.set(bucketKey, entry);
      return res.status(429).json({
        error: 'Rate limit exceeded. Try again soon.',
        retryAfter: retryAfterSec
      });
    }

    entry.timestamps.push(now);
    buckets.set(bucketKey, entry);
    next();
  };
}

module.exports = { rateLimit };
