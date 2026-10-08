const { signSession, parseCookies } = require('../_lib');

module.exports = async function (req, res) {
  try {
    const code = req.query.code;
    const state = req.query.state;
    const cookies = parseCookies(req);
    if (!code || !state || state !== cookies.oauth_state) {
      res.status(400).send('Sign-in failed: the request could not be verified. Go back and try again.');
      return;
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: 'https://' + req.headers.host + '/api/auth/callback'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      res.status(400).send('Sign-in failed: GitHub did not accept the login. Check the client ID and secret.');
      return;
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer ' + tokenJson.access_token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'thryve-site'
      }
    });
    const user = await userRes.json();
    const login = user && user.login;

    const allowed = (process.env.ADMIN_GITHUB_USERS || '')
      .split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);

    const clearState = 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

    if (!login || allowed.indexOf(login.toLowerCase()) === -1) {
      res.setHeader('Set-Cookie', clearState);
      res.writeHead(302, { Location: '/admin?error=denied' });
      res.end();
      return;
    }

    const session = signSession({ u: login, exp: Date.now() + 8 * 60 * 60 * 1000 });
    res.setHeader('Set-Cookie', [
      'session=' + session + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800',
      clearState
    ]);
    res.writeHead(302, { Location: '/admin' });
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Sign-in failed. Please try again.');
  }
};
