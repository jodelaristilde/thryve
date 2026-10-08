const crypto = require('crypto');
const { redis, signSession, readBody, isJson } = require('../_lib');

function same(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass || !process.env.SESSION_SECRET) {
    res.status(500).json({ error: 'Admin login is not set up yet.' });
    return;
  }
  if (!isJson(req)) { res.status(415).json({ error: 'Send JSON.' }); return; }

  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const failKey = 'loginfail:' + ip;

  // Lock out after 5 wrong tries for 15 minutes.
  try {
    const tries = Number((await redis(['GET', failKey])) || 0);
    if (tries >= 5) {
      res.status(429).json({ error: 'Too many tries. Wait 15 minutes and try again.' });
      return;
    }
  } catch (e) { /* database unavailable: skip the lockout check */ }

  const b = readBody(req);
  const okUser = same(b.username || '', user);
  const okPass = same(b.password || '', pass);

  if (!(okUser && okPass)) {
    try {
      const n = await redis(['INCR', failKey]);
      if (n === 1) await redis(['EXPIRE', failKey, 900]);
    } catch (e) { /* ignore */ }
    res.status(401).json({ error: 'Wrong username or password.' });
    return;
  }

  try { await redis(['DEL', failKey]); } catch (e) { /* ignore */ }

  const session = signSession({ u: user, exp: Date.now() + 8 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', 'session=' + session + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800');
  res.status(200).json({ ok: true });
};
