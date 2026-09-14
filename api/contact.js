'use strict';

/**
 * POST /api/contact: Flake Lab contact form.
 *
 * Sends two emails through an SMTP relay (Brevo by default), with no npm dependencies:
 *   1. the enquiry to MAIL_TO (info@flakelab.ca), with Reply-To set to the visitor
 *   2. a short confirmation from MAIL_FROM (no-reply@flakelab.ca) to the visitor
 * Email designs live in api/_email/templates.js.
 *
 * Environment variables (set them in Vercel, never in this file):
 *   SMTP_USER        required  SMTP login shown in Brevo > SMTP & API > SMTP
 *   SMTP_PASS        required  SMTP key
 *   SMTP_HOST        optional  default smtp-relay.brevo.com
 *   SMTP_PORT        optional  default 465 (implicit TLS)
 *   MAIL_FROM        optional  default no-reply@flakelab.ca
 *   MAIL_TO          optional  default info@flakelab.ca
 *   ALLOWED_ORIGINS  optional  extra comma-separated origins allowed to post (same-origin is always allowed)
 */

const tls = require('node:tls');
const crypto = require('node:crypto');
const templates = require('./_email/templates');

const MAX_BODY_BYTES = 16 * 1024;
const MIN_FILL_MS = 2500;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const LIMITS = { name: 80, email: 254, phone: 30, message: 1000 };
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

const chr = (n) => String.fromCharCode(n);
const NUL = chr(0);
// C0 control characters plus DEL, built from char codes so the source file stays plain ASCII.
const CONTROL_ALL = new RegExp('[' + chr(0) + '-' + chr(31) + chr(127) + ']+', 'g');
const CONTROL_EXCEPT_NEWLINE = new RegExp('[' + chr(0) + '-' + chr(9) + chr(11) + '-' + chr(31) + chr(127) + ']', 'g');

const recentByIp = new Map();

function env(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real);
  const fwd = req.headers['x-forwarded-for'];
  return fwd ? String(fwd).split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Best effort only: counts live per warm function instance.
function rateLimited(ip) {
  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);
  if (recentByIp.size > 5000) recentByIp.clear();
  return hits.length > RATE_MAX;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  const selfHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const extra = env('ALLOWED_ORIGINS', '').split(',').map((s) => s.trim()).filter(Boolean);
  return host === selfHost || extra.includes(origin);
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  if (raw === null) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw Object.assign(new Error('too large'), { status: 413 });
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw Object.assign(new Error('too large'), { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

// Single-line fields lose all control characters, which blocks email header injection.
function oneLine(v) {
  return String(v == null ? '' : v).replace(CONTROL_ALL, ' ').replace(/\s+/g, ' ').trim();
}

function multiLine(v) {
  return String(v == null ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_EXCEPT_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validate(body) {
  const name = oneLine(body.name);
  const email = oneLine(body.email).toLowerCase();
  const phone = oneLine(body.phone);
  const message = multiLine(body.message);
  const digits = phone.replace(/\D/g, '').length;

  if (!name) return { error: 'Please add your name.' };
  if (name.length > LIMITS.name) return { error: 'That name is a little long. Please shorten it.' };
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) return { error: 'Please enter a valid email address.' };
  if (!phone || phone.length > LIMITS.phone || digits < 7 || digits > 15 || /[^0-9+().\-\s]/.test(phone)) {
    return { error: 'Please enter a phone number we can reach you on.' };
  }
  if (!message) return { error: 'Please tell us what you need.' };
  if (message.length > LIMITS.message) return { error: 'Please keep your message under 1000 characters.' };
  return { value: { name, email, phone, message } };
}

// ---------- email formatting ----------

function encodeHeader(text) {
  if (/^[ -~]*$/.test(text) && text.length <= 70) return text;
  const words = [];
  let chunk = '';
  for (const ch of text) {
    if (Buffer.byteLength(chunk + ch) > 42) { words.push(chunk); chunk = ''; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => '=?UTF-8?B?' + Buffer.from(w, 'utf8').toString('base64') + '?=').join('\r\n ');
}

function mailbox(address, displayName) {
  return displayName ? `${encodeHeader(displayName)} <${address}>` : `<${address}>`;
}

function base64Lines(text) {
  return Buffer.from(text, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
}

// Builds a MIME message: text/plain alternative plus an HTML part with inline (CID) images.
function buildMessage({ from, fromName, to, replyTo, subject, text, html, inline = [], domain }) {
  const alt = 'fl-alt-' + crypto.randomBytes(10).toString('hex');
  const rel = 'fl-rel-' + crypto.randomBytes(10).toString('hex');
  const headers = [
    `From: ${mailbox(from, fromName)}`,
    `To: ${mailbox(to)}`,
    replyTo ? `Reply-To: ${mailbox(replyTo)}` : null,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${alt}"`,
  ].filter(Boolean);
  const htmlPart = inline.length
    ? [
        `Content-Type: multipart/related; boundary="${rel}"`,
        '',
        `--${rel}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Lines(html),
        ...inline.flatMap((img) => [
          `--${rel}`,
          `Content-Type: ${img.contentType}; name="${img.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-ID: <${img.cid}>`,
          `Content-Disposition: inline; filename="${img.filename}"`,
          '',
          img.base64.replace(/.{1,76}/g, '$&\r\n'),
        ]),
        `--${rel}--`,
      ]
    : ['Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lines(html)];
  return [
    ...headers,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${alt}`,
    ...htmlPart,
    `--${alt}--`,
    '',
  ].join('\r\n');
}

// ---------- minimal SMTP client (implicit TLS) ----------

function smtpConnect({ host, port, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    const lines = [];
    const waiters = [];
    let buffer = '';
    let failure = null;

    const takeReply = () => {
      const end = lines.findIndex((l) => /^\d{3}(?: |$)/.test(l));
      if (end === -1) return null;
      const block = lines.splice(0, end + 1);
      return { code: Number(block[end].slice(0, 3)), text: block.map((l) => l.slice(4)).join(' ') };
    };
    const flush = () => {
      while (waiters.length) {
        const r = takeReply();
        if (r) waiters.shift().resolve(r);
        else if (failure) waiters.shift().reject(failure);
        else break;
      }
    };

    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP timeout')));
    socket.on('data', (chunk) => {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\r\n')) !== -1) { lines.push(buffer.slice(0, i)); buffer = buffer.slice(i + 2); }
      flush();
    });
    socket.on('error', (err) => { failure = err; flush(); });
    socket.on('close', () => { failure = failure || new Error('SMTP connection closed'); flush(); });

    const read = () => new Promise((res, rej) => { waiters.push({ resolve: res, reject: rej }); flush(); });
    // Errors carry only the step label, never the command, so credentials can't reach the logs.
    const command = async (line, expect, label) => {
      if (line !== null) socket.write(line + '\r\n');
      const r = await read();
      if (!expect.includes(r.code)) throw new Error(`SMTP ${label} failed (${r.code}): ${r.text.slice(0, 200)}`);
      return r;
    };

    socket.once('secureConnect', () => resolve({ socket, command }));
    socket.once('error', reject);
  });
}

async function sendAll(cfg, messages) {
  const { socket, command } = await smtpConnect({ host: cfg.host, port: cfg.port });
  const results = [];
  try {
    await command(null, [220], 'greeting');
    await command(`EHLO ${cfg.domain}`, [250], 'EHLO');
    const auth = Buffer.from(NUL + cfg.user + NUL + cfg.pass, 'utf8').toString('base64');
    await command(`AUTH PLAIN ${auth}`, [235], 'AUTH');
    for (const m of messages) {
      try {
        await command(`MAIL FROM:<${cfg.from}>`, [250], 'MAIL FROM');
        await command(`RCPT TO:<${m.to}>`, [250, 251], 'RCPT TO');
        await command('DATA', [354], 'DATA');
        const body = m.data.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
        await command(`${body}\r\n.`, [250], 'message');
        results.push({ ok: true });
      } catch (err) {
        results.push({ ok: false, error: err });
        if (m.required) throw err;
        await command('RSET', [250], 'RSET').catch(() => {});
      }
    }
    await command('QUIT', [221], 'QUIT').catch(() => {});
  } finally {
    socket.end();
  }
  return results;
}

// ---------- handler ----------

function describe(err) {
  return (err && (err.message || err.code || (err.errors && err.errors.map((e) => e.code || e.message).join(', ')))) || String(err);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { ok: false, error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) return reply(res, 403, { ok: false, error: 'Forbidden.' });

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return reply(res, err.status || 400, { ok: false, error: 'Invalid request.' });
  }

  // Bot traps: hidden field filled in, or a form submitted faster than a person could. Pretend success.
  if (oneLine(body.company) || !(Number(body.elapsed) >= MIN_FILL_MS)) return reply(res, 200, { ok: true });

  if (rateLimited(clientIp(req))) {
    return reply(res, 429, { ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  }

  const checked = validate(body);
  if (checked.error) return reply(res, 400, { ok: false, error: checked.error });

  const cfg = {
    host: env('SMTP_HOST', 'smtp-relay.brevo.com'),
    port: Number(env('SMTP_PORT', '465')),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('MAIL_FROM', 'no-reply@flakelab.ca'),
    to: env('MAIL_TO', 'info@flakelab.ca'),
  };
  cfg.domain = cfg.from.split('@')[1] || 'flakelab.ca';
  const fallback = `Sorry, we couldn't send that right now. Please email ${cfg.to}.`;

  if (!cfg.user || !cfg.pass) {
    console.error('[contact] SMTP_USER or SMTP_PASS is not set');
    return reply(res, 503, { ok: false, error: fallback });
  }

  const v = checked.value;
  try {
    const [, confirmation] = await sendAll(cfg, [
      { to: cfg.to, data: buildMessage({ ...templates.enquiry(v, cfg), from: cfg.from, fromName: 'Flake Lab website', to: cfg.to, replyTo: v.email, domain: cfg.domain }), required: true },
      { to: v.email, data: buildMessage({ ...templates.confirmation(v, cfg), from: cfg.from, fromName: 'Flake Lab', to: v.email, domain: cfg.domain }), required: false },
    ]);
    if (confirmation && !confirmation.ok) console.error('[contact] confirmation email failed:', describe(confirmation.error));
    return reply(res, 200, { ok: true });
  } catch (err) {
    console.error('[contact] enquiry email failed:', describe(err));
    return reply(res, 502, { ok: false, error: fallback });
  }
};
