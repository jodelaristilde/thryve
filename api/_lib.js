const crypto = require('crypto');

// ---------- Storage (Upstash Redis REST, added from the Vercel Marketplace) ----------
function redisUrl() { return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL; }
function redisToken() { return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN; }

async function redis(command) {
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) throw new Error('Database is not connected (missing Redis environment variables)');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// ---------- Courses ----------
const DEFAULT_COURSES = [
  'Advanced Life Support (ACLS)',
  'NURSE AID TRAINING PROGRAM (CNA)',
  'Phlebotomy Class',
  'Basic Life Support (BLS)'
];

// Courses saved from the admin page, or the starting list if none were saved yet.
async function getCourses() {
  try {
    const raw = await redis(['GET', 'courses']);
    return raw ? JSON.parse(raw) : DEFAULT_COURSES;
  } catch (e) {
    return DEFAULT_COURSES;
  }
}

// ---------- Signed session cookie ----------
function hmac(body) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(body).digest('base64url');
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + hmac(body);
}

function verifySession(token) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(hmac(parts[0]));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Returns the GitHub username if the request comes from an allowed admin, otherwise null.
function getAdmin(req) {
  const s = verifySession(parseCookies(req).session);
  if (!s) return null;
  const allowed = (process.env.ADMIN_GITHUB_USERS || '')
    .split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  return allowed.indexOf(String(s.u).toLowerCase()) > -1 ? s.u : null;
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body || {};
}

function isJson(req) {
  return String(req.headers['content-type'] || '').indexOf('application/json') > -1;
}

module.exports = { redis, getCourses, signSession, parseCookies, getAdmin, readBody, isJson };
