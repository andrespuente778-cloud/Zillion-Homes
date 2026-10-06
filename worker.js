// Cloudflare Worker: serves the static site and handles the inquiry form at /api/submit.
// Emails the inquiry to your inbox, then redirects (302) to /success.html.
//
// FREE sending: uses the Email Routing "send email" binding (env.SEB). It can deliver to
// any address you verified under Email Routing (your Gmail), and info@zillionhomes.rent
// already forwards to that same Gmail.
//
// One secret is needed in Cloudflare (Settings > Variables and Secrets):
//   NOTIFY_TO = the Gmail address you verified in Email Routing
// Optional fallback: a RESEND_API_KEY secret (Resend free plan) if env.SEB ever fails.

import { EmailMessage } from 'cloudflare:email';

const FROM_EMAIL = 'inquiries@zillionhomes.rent';
const FROM_NAME = 'Zillion Homes';
const SITE_EMAIL = 'info@zillionhomes.rent';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/submit') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return handleSubmit(request, env, url.origin);
    }

    // Everything else is your normal website (index.html, photos, success.html, ...)
    return env.ASSETS.fetch(request);
  }
};

async function handleSubmit(request, env, origin) {
  const success = () => Response.redirect(`${origin}/success.html`, 302);
  const failure = () => Response.redirect(`${origin}/?error=1#contact`, 302);

  try {
    const form = await request.formData();

    // Hidden spam trap: real visitors never tick this box
    if (form.get('botcheck')) return success();

    const get = (key, max, multiline) => {
      const v = String(form.get(key) || '').trim().slice(0, max);
      return multiline ? v : v.replace(/\s+/g, ' ');
    };
    const name = get('name', 100);
    const email = get('email', 200);
    const phone = get('phone', 40);
    const property = get('property', 300);
    const message = get('message', 5000, true);

    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure();

    const subject = `New inquiry from ${name}${property ? ' - ' + property : ''}`;
    const text = [
      'New inquiry from the Zillion Homes website', '',
      `Name: ${name}`, `Email: ${email}`, `Phone: ${phone || '-'}`, `Interested in: ${property || '-'}`,
      '', 'Message:', message, '', `(Reply to this email to answer ${name} directly.)`
    ].join('\n');

    const mail = { email, subject, text };
    return (await deliver(env, mail)) ? success() : failure();
  } catch (err) {
    console.error(err);
    return failure();
  }
}

async function deliver(env, mail) {
  // 1) Free: Email Routing send-email binding -> your verified Gmail
  if (env.SEB && env.NOTIFY_TO) {
    try {
      const raw = rawEmail({ to: env.NOTIFY_TO, replyTo: mail.email, subject: mail.subject, text: mail.text });
      await env.SEB.send(new EmailMessage(FROM_EMAIL, env.NOTIFY_TO, raw));
      return true;
    } catch (e) {
      console.error('SEB send failed:', e && e.message);
    }
  } else {
    console.error('Missing SEB binding or NOTIFY_TO secret');
  }

  // 2) Optional fallback: Resend (only used if you add a RESEND_API_KEY secret)
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [SITE_EMAIL],
          reply_to: mail.email,
          subject: mail.subject,
          text: mail.text
        })
      });
      if (res.ok) return true;
      console.error('Resend error', res.status, await res.text());
    } catch (e) {
      console.error('Resend failed:', e && e.message);
    }
  }
  return false;
}

// Builds a plain-text email message (no libraries needed)
function rawEmail({ to, replyTo, subject, text }) {
  const b64 = s => {
    let bin = '';
    new TextEncoder().encode(s).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const subj = /^[\x20-\x7E]*$/.test(subject) ? subject : `=?UTF-8?B?${b64([...subject].slice(0, 40).join(''))}?=`;
  return [
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subj}`,
    `Message-ID: <${crypto.randomUUID()}@zillionhomes.rent>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(text).replace(/(.{76})/g, '$1\r\n')
  ].join('\r\n');
}
