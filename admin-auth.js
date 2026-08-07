const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'sott_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();
const sessions = new Map();
const DUMMY_HASH = '$2b$10$FSdM2PUFlv9gCmfQg1o4hewdzR0iEiwq6m4MY5h6nh0bJ5P7T4gLa';

function isAdminConfigured() {
  const username = String(process.env.ADMIN_USERNAME || '').trim();
  const hash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  const secret = String(process.env.SESSION_SECRET || '');
  return Boolean(username && /^\$2[aby]\$/.test(hash) && secret.length >= 32);
}

async function verifyCredentials(username, password) {
  const configuredUsername = String(process.env.ADMIN_USERNAME || '').trim();
  const hash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  const candidateHash = /^\$2[aby]\$/.test(hash) ? hash : DUMMY_HASH;
  const passwordMatches = typeof password === 'string' && password.length <= 200
    ? await bcrypt.compare(password, candidateHash)
    : false;
  return isAdminConfigured()
    && safeEqual(String(username || ''), configuredUsername)
    && passwordMatches;
}

function createSession() {
  if (!isAdminConfigured()) throw new Error('Admin authentication is not configured');
  cleanupExpiredSessions();
  const id = crypto.randomBytes(32).toString('base64url');
  const payload = {
    admin: true,
    exp: Date.now() + SESSION_TTL_MS,
    csrf: crypto.randomBytes(24).toString('base64url'),
  };
  sessions.set(id, payload);
  return { value: `${id}.${sign(id)}`, payload };
}

function readSession(req) {
  if (!isAdminConfigured()) return null;
  const cookies = parseCookies(req.headers.cookie);
  const value = cookies[COOKIE_NAME];
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!safeEqual(signature, sign(id))) return null;
  const payload = sessions.get(id);
  if (!payload || payload.admin !== true || payload.exp <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return payload;
}

function destroySession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const value = cookies[COOKIE_NAME];
  if (!value) return;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return;
  const id = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (safeEqual(signature, sign(id))) sessions.delete(id);
}

function setSessionCookie(res, value) {
  const secure = useSecureCookie() ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function clearSessionCookie(res) {
  const secure = useSecureCookie() ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function useSecureCookie() {
  return process.env.NODE_ENV === 'production' || /^https:\/\//i.test(String(process.env.PUBLIC_BASE_URL || '').trim());
}

function requireAdminPage(req, res, next) {
  const session = readSession(req);
  if (!session) return res.redirect(302, '/admin/login');
  req.adminSession = session;
  return next();
}

function requireAdminApi(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Требуется вход в админ-панель' });
  req.adminSession = session;
  return next();
}

function requireCsrf(req, res, next) {
  if (!req.adminSession || !isSameOrigin(req)) {
    return res.status(403).json({ error: 'Запрос отклонён' });
  }
  const token = req.get('x-csrf-token');
  if (!token || !safeEqual(token, req.adminSession.csrf)) {
    return res.status(403).json({ error: 'Запрос отклонён' });
  }
  return next();
}

function isSameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return false;
  try {
    const expected = `${req.protocol}://${req.get('host')}`;
    return new URL(origin).origin === expected;
  } catch (_error) {
    return false;
  }
}

function checkLoginRateLimit(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || record.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }
  return { allowed: record.count < LOGIN_MAX_ATTEMPTS, retryAfterMs: Math.max(0, record.resetAt - now) };
}

function recordLoginFailure(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || record.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  record.count += 1;
}

function clearLoginFailures(ip) {
  loginAttempts.delete(String(ip || 'unknown'));
}

function parseCookies(header = '') {
  return String(header).split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
    return cookies;
  }, {});
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');
}

function cleanupExpiredSessions() {
  const now = Date.now();
  sessions.forEach((session, id) => {
    if (!session || session.exp <= now) sessions.delete(id);
  });
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = {
  LOGIN_MAX_ATTEMPTS,
  checkLoginRateLimit,
  clearLoginFailures,
  clearSessionCookie,
  createSession,
  destroySession,
  isAdminConfigured,
  isSameOrigin,
  readSession,
  recordLoginFailure,
  requireAdminApi,
  requireAdminPage,
  requireCsrf,
  setSessionCookie,
  verifyCredentials,
};
