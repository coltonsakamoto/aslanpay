module.exports = (req, res, next) => {
  // Prefer session cookie
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  // Fallback to Bearer token for legacy agents
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.sendStatus(401);

  const token = h.slice(7).trim();
  // look up userId from token (existing logic) …
  if (!userId) return res.sendStatus(401);
  req.userId = userId;
  next();
}; 