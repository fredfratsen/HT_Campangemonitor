// E-mail from the app, through the mail server set under Instellingen › Integraties (see secrets.js). For now one
// kind: every new bug or idea goes to the address the Dev set under Instellingen › Bugs & ideeën.
//
// On a long-running server a mail goes out right away, in the background. In a Netlify Function nothing runs after
// the response, and a request can be rerun on fresh data (see netlify.js), so there mails are collected per attempt
// and sent once the request's data was saved (begin/commit, like the audit log). Every delivery, sent or failed,
// goes into the audit log, without the text of the mail.
import nodemailer from 'nodemailer';

// Netlify stops a function after 10 seconds.
const CONNECT_MS = 5000, SOCKET_MS = 8000;
const isLocal = host => /^(localhost|127\.0\.0\.1|::1)$/.test(host);

function transportFor(c) {
  const port = Number(c.port);
  // Port 465 is TLS from the start; on other ports the password only goes over STARTTLS, except to a mail server on
  // this machine.
  return nodemailer.createTransport({
    host: c.host, port, secure: port === 465, requireTLS: port !== 465 && !isLocal(c.host),
    auth: { user: c.user, pass: c.pass }, connectionTimeout: CONNECT_MS, greetingTimeout: CONNECT_MS, socketTimeout: SOCKET_MS,
  });
}

/** What went wrong, in Dutch. */
function mailError(e) {
  if (e.code === 'EAUTH') return 'De mailserver weigert de gebruikersnaam of het wachtwoord.';
  if (['ECONNECTION', 'ETIMEDOUT', 'EDNS', 'ESOCKET', 'ETLS'].includes(e.code)) return `Kon de mailserver niet bereiken: ${e.message}`;
  if (e.code === 'EENVELOPE') return `De mailserver weigert het adres: ${e.message}`;
  return e.message || 'Onbekende fout bij het versturen.';
}

/** Logs in on the mail server without sending anything. Returns { ok, message } or { ok: false, error }. */
export async function testSmtp(creds) {
  try {
    await transportFor(creds).verify();
    return { ok: true, message: `Verbonden met ${creds.host} als ${creds.user}.` };
  } catch (e) { return { ok: false, error: mailError(e) }; }
}

/**
 * @param o.secrets   createSecrets: the 'smtp' integration
 * @param o.audit     where deliveries are logged
 * @param o.deferred  collect mails until commit() (Netlify) instead of sending right away
 */
export function createMailer({ secrets, audit, deferred = false }) {
  let outbox = [];

  /** Sends { to, subject, text, kind } now. Returns '' or what went wrong; never throws. */
  async function deliver({ to, subject, text, kind }) {
    const c = secrets.get('smtp');
    let error = '';
    if (!c) error = 'Er is geen mailserver ingesteld (Instellingen › Integraties).';
    else {
      try { await transportFor(c).sendMail({ from: { name: 'Campagnemonitor', address: c.from }, to, subject, text }); }
      catch (e) { error = mailError(e); }
    }
    audit.log(error ? 'mail.failed' : 'mail.sent', { details: { aan: to, soort: kind, ...(error ? { fout: error } : {}) } });
    if (error) console.error('[mail]', error);
    return error;
  }

  return {
    deliver,
    send(msg) { if (deferred) outbox.push(msg); else deliver(msg).catch(e => console.error('[mail]', e)); },
    /** Start of a request (attempt): forget mails of an attempt that was rerun. */
    begin() { outbox = []; },
    /** After the request's data was saved: send its mails. */
    async commit() {
      const list = outbox; outbox = [];
      for (const m of list) await deliver(m).catch(e => console.error('[mail]', e));
    },
  };
}
