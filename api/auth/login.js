const crypto = require('crypto');

module.exports = function (req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('GITHUB_CLIENT_ID is not set in Vercel environment variables.');
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = 'https://' + req.headers.host + '/api/auth/callback';
  const url = 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state: state
  }).toString();
  res.setHeader('Set-Cookie', 'oauth_state=' + state + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600');
  res.writeHead(302, { Location: url });
  res.end();
};
