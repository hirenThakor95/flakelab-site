'use strict';

// Branded email templates for the contact form. Email-safe: tables, inline styles, no scripts.
// Bungee and Space Grotesk load where the mail app allows web fonts (Apple Mail, iOS); others fall back cleanly.

const { wordmark } = require('./assets');

const C = {
  cream: '#F2EDE1', ink: '#14140F', blue: '#2A3BD0', lime: '#D6DC4E',
  clay: '#A9552A', body: '#2d2b22', muted: '#6b6656',
};
const DISPLAY = "'Bungee','Arial Black','Arial Bold',Gadget,'Helvetica Neue',Arial,sans-serif";
const TEXT = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const CHUNKY = `border:3px solid ${C.ink};border-right-width:8px;border-bottom-width:8px;border-radius:26px;`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const escLines = (s) => esc(s).replace(/\n/g, '<br>');

function shell({ title, preheader, rows }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bungee&amp;family=Space+Grotesk:wght@400;500;700&amp;display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { color:${C.blue}; }
  @media (max-width: 520px) {
    .fl-pad { padding:26px 22px !important; }
    .fl-h1 { font-size:28px !important; }
    .fl-h2 { font-size:22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream};">
<tr><td align="center" style="padding:28px 14px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
${header()}
${spacer(22)}
${rows}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function header() {
  const w = 240;
  const h = Math.round((wordmark.height * w) / wordmark.width);
  return `<tr><td bgcolor="${C.blue}" align="center" style="background:${C.blue};${CHUNKY}padding:30px 24px 24px;">
<img src="cid:${wordmark.cid}" width="${w}" height="${h}" alt="FLAKE LAB" style="display:block;margin:0 auto;width:${w}px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;font-family:${DISPLAY};font-size:40px;line-height:1.1;color:${C.lime};">
<div style="margin:16px 0 0;font-family:${TEXT};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:${C.cream};">Products by Diwan Bakery</div>
</td></tr>`;
}

const spacer = (h) => `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

const card = (bg, inner) => `<tr><td bgcolor="${bg}" class="fl-pad" style="background:${bg};${CHUNKY}padding:34px 36px;">${inner}</td></tr>`;

const eyebrow = (text, color) =>
  `<div style="margin:0 0 12px;font-family:${DISPLAY};font-size:13px;line-height:1.2;letter-spacing:1px;text-transform:uppercase;color:${color};">${esc(text)}</div>`;

const h1 = (text, color = C.ink) =>
  `<h1 class="fl-h1" style="margin:0 0 16px;font-family:${DISPLAY};font-size:36px;line-height:1.05;font-weight:400;text-transform:uppercase;color:${color};">${esc(text)}</h1>`;

const h2 = (text, color) =>
  `<h2 class="fl-h2" style="margin:0 0 12px;font-family:${DISPLAY};font-size:26px;line-height:1.05;font-weight:400;text-transform:uppercase;color:${color};">${esc(text)}</h2>`;

const p = (html, color = C.body, extra = '') =>
  `<p style="margin:0 0 14px;font-family:${TEXT};font-size:17px;line-height:1.6;color:${color};${extra}">${html}</p>`;

function button({ href, label, bg, fg, top = 22 }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${top}px 0 0;">
<tr><td bgcolor="${bg}" style="background:${bg};border:3px solid ${C.ink};border-right-width:6px;border-bottom-width:6px;border-radius:999px;">
<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:${DISPLAY};font-size:15px;line-height:1.2;letter-spacing:.5px;text-transform:uppercase;color:${fg};text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

function footer(lines) {
  return `<tr><td align="center" style="padding:26px 12px 0;">
<div style="font-family:${DISPLAY};font-size:13px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:${C.ink};">Flake Lab &middot; By Diwan Bakery</div>
<div style="margin:6px 0 0;font-family:${TEXT};font-size:13px;line-height:1.6;color:${C.muted};">From Anand. Since 1974. Now in Canada.</div>
${lines.map((l) => `<div style="margin:10px auto 0;max-width:460px;font-family:${TEXT};font-size:12px;line-height:1.6;color:${C.muted};">${l}</div>`).join('\n')}
</td></tr>`;
}

// ---------- visitor confirmation (from no-reply@) ----------

function confirmation(v, cfg) {
  const first = v.name.split(' ')[0];
  const greetName = /^[\p{L}][\p{L}'.-]{0,29}$/u.test(first) ? first : '';
  const title = greetName ? `Thanks, ${greetName}!` : 'Thanks for saying hi!';
  const store = 'https://store.flakelab.ca';
  const insta = 'https://www.instagram.com/flakelab.ca';

  const rows = [
    card(C.lime, [
      eyebrow('Message received', C.clay),
      h1(title),
      p("We've got your note and we'll get back to you soon."),
      p("Hungry in the meantime? This week's lineup is on the store, and bake-day photos are on Instagram.", C.body, 'margin-bottom:0;'),
      button({ href: store, label: "See this week's lineup", bg: C.ink, fg: C.cream }),
    ].join('\n')),
    spacer(22),
    card(C.blue, [
      h2('One bake day. Every Sunday.', C.lime),
      p('We bake once a week and sell it all. Order on the store, pick it up warm.', C.cream),
      p(`<a href="${insta}" style="font-family:${DISPLAY};font-size:14px;letter-spacing:.5px;text-transform:uppercase;color:${C.lime};text-decoration:none;">@flakelab.ca on Instagram &rarr;</a>`, C.cream, 'margin-bottom:0;'),
    ].join('\n')),
    footer([
      `You're getting this because you sent a message through flakelab.ca. This inbox isn't monitored, so please don't reply. To add anything, email <a href="mailto:${esc(cfg.to)}" style="color:${C.blue};">${esc(cfg.to)}</a>.`,
    ]),
  ].join('\n');

  const text = [
    `${title}`,
    '',
    "We've got your note and we'll get back to you soon.",
    '',
    "Hungry in the meantime? This week's lineup is on the store: https://store.flakelab.ca",
    'Bake-day photos are on Instagram: @flakelab.ca',
    '',
    'One bake day. Every Sunday.',
    '',
    '--',
    'Flake Lab · By Diwan Bakery',
    'From Anand. Since 1974. Now in Canada.',
    `This inbox isn't monitored, so please don't reply. To add anything, email ${cfg.to}.`,
  ].join('\n');

  return {
    subject: 'Thanks for reaching out to Flake Lab',
    text,
    html: shell({ title: 'Thanks for reaching out to Flake Lab', preheader: "We got your message and we'll be in touch soon.", rows }),
    inline: [wordmark],
  };
}

// ---------- enquiry to the team (info@) ----------

function enquiry(v, cfg) {
  const sent = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const tel = v.phone.replace(/[^0-9+]/g, '');
  const replyHref = `mailto:${v.email}?subject=${encodeURIComponent('Re: your message to Flake Lab')}`;
  const firstName = v.name.split(' ')[0];

  const detail = (label, valueHtml) => `<tr>
<td valign="top" style="padding:10px 16px 10px 0;width:74px;font-family:${DISPLAY};font-size:12px;line-height:1.6;letter-spacing:.5px;text-transform:uppercase;color:${C.clay};white-space:nowrap;">${label}</td>
<td valign="top" style="padding:10px 0;font-family:${TEXT};font-size:17px;line-height:1.5;color:${C.ink};word-break:break-word;">${valueHtml}</td>
</tr>`;

  const rows = [
    card(C.cream, [
      eyebrow('New website enquiry', C.blue),
      h1(v.name),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid rgba(20,20,15,.15);margin:4px 0 18px;">
${detail('Email', `<a href="mailto:${esc(v.email)}" style="color:${C.blue};">${esc(v.email)}</a>`)}
${detail('Phone', `<a href="tel:${esc(tel)}" style="color:${C.blue};">${esc(v.phone)}</a>`)}
</table>`,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td bgcolor="${C.lime}" style="background:${C.lime};border:3px solid ${C.ink};border-radius:18px;padding:18px 20px;">
${eyebrow('Message', C.clay)}
<div style="font-family:${TEXT};font-size:17px;line-height:1.6;color:${C.ink};word-break:break-word;">${escLines(v.message)}</div>
</td></tr></table>`,
      button({ href: replyHref, label: `Reply to ${firstName}`, bg: C.lime, fg: C.ink, top: 24 }),
      button({ href: `tel:${tel}`, label: `Call ${v.phone}`, bg: C.cream, fg: C.ink, top: 14 }),
    ].join('\n')),
    footer([`Sent from the contact form on flakelab.ca at ${esc(sent)}. Hit reply to answer ${esc(firstName)} directly.`]),
  ].join('\n');

  const text = [
    'New website enquiry',
    '',
    `Name:  ${v.name}`,
    `Email: ${v.email}`,
    `Phone: ${v.phone}`,
    '',
    'Message:',
    v.message,
    '',
    `Sent from the contact form on flakelab.ca at ${sent}.`,
    'Reply to this email to answer them directly.',
  ].join('\n');

  return {
    subject: `New enquiry from ${v.name}`,
    text,
    html: shell({ title: `New enquiry from ${v.name}`, preheader: `${v.name} · ${v.phone} · ${v.message.slice(0, 90)}`, rows }),
    inline: [wordmark],
  };
}

module.exports = { enquiry, confirmation };
