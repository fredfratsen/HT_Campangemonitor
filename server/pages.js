// Server-rendered pages outside the app: login, two-factor, invites, password reset and the privacy notice.
// Plain HTML forms, no JavaScript, same look as the app.
import qrcode from 'qrcode-generator';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function qrDataUrl(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return 'data:image/svg+xml;base64,' + Buffer.from(q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })).toString('base64');
}

const CSS = `
@font-face{font-family:'Inter';font-weight:400 600;font-display:swap;src:url('/fonts/inter-latin.woff2') format('woff2')}
@font-face{font-family:'Poppins';font-weight:600;font-display:swap;src:url('/fonts/poppins-600-latin.woff2') format('woff2')}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:#FDFBF8;color:#1D1D1B;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:400px;background:#FFFFFF;border:1px solid #E4E1DE;border-radius:12px;box-shadow:0 2px 8px rgba(29,29,27,.09);padding:32px 28px;display:flex;flex-direction:column;gap:20px}
.card.wide{max-width:640px}
.logo{height:34px;align-self:flex-start}
h1{margin:0;font-family:Poppins,sans-serif;font-weight:600;font-size:24px;line-height:1.2;letter-spacing:-.01em}
h2{margin:0;font-family:Poppins,sans-serif;font-weight:600;font-size:17px}
p,li{margin:4px 0 0;font-size:14px;color:#5C5C5A;line-height:1.55}
ol,ul{margin:0;padding-left:20px}
label{font-size:14px;font-weight:600;display:block;margin-bottom:8px}
input{width:100%;height:44px;border:1px solid #E4E1DE;border-radius:8px;padding:0 14px;font:inherit;font-size:15px;background:#fff}
input[readonly]{background:#F5F2ED;color:#5C5C5A}
input:focus{outline:2px solid rgba(27,27,99,.3);outline-offset:0;border-color:#1B1B63}
.hint{font-size:12px;color:#8C8C8A;margin-top:6px}
button,.btn{display:inline-flex;align-items:center;justify-content:center;height:48px;border:0;border-radius:8px;background:linear-gradient(135deg,#F9CE00 0%,#FB8915 100%);color:#fff;font:inherit;font-size:16px;font-weight:600;cursor:pointer;text-decoration:none;width:100%}
button:focus-visible,.btn:focus-visible{outline:2px solid rgba(27,27,99,.45);outline-offset:2px}
a{color:#1B1B63}
.err{margin:0;background:#FDECEA;color:#D32F2F;border-radius:8px;padding:10px 12px;font-size:14px}
.ok{margin:0;background:#E6F4ED;color:#1A7A4A;border-radius:8px;padding:10px 12px;font-size:14px}
.note{background:#F5F2ED;border-radius:8px;padding:10px 12px;font-size:13px;color:#3C3C3A;line-height:1.5}
.foot{font-size:12px;color:#8C8C8A;text-align:center}
.code{font-family:'SF Mono','Fira Code',Consolas,monospace;font-size:15px;letter-spacing:.02em;background:#F5F2ED;border-radius:8px;padding:10px 12px;overflow-wrap:anywhere;text-align:center}
.codes{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-family:'SF Mono','Fira Code',Consolas,monospace;font-size:14px}
.codes span{background:#F5F2ED;border-radius:6px;padding:8px;text-align:center}
.qr{width:184px;height:184px;align-self:center;image-rendering:pixelated}
.privacy h2{margin-top:8px}
`;

export function page({ title, body, wide = false }) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Campagnemonitor</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
</head>
<body>
<div class="card${wide ? ' wide' : ''}">
<img class="logo" src="/logo.png" alt="Horeca Toppers">
${body}
</div>
</body>
</html>`;
}

const msg = (error, ok) => (error ? `<p class="err">${esc(error)}</p>` : '') + (ok ? `<p class="ok">${esc(ok)}</p>` : '');
const privacyLink = '<div class="foot"><a href="/privacy">Privacy</a></div>';

export const loginPage = ({ error, ok, email = '' } = {}) => page({ title: 'Inloggen', body: `
<form method="post" action="/login" style="display:flex;flex-direction:column;gap:20px">
  <div><h1>Campagnemonitor</h1><p>Log in met je eigen account.</p></div>
  ${msg(error, ok)}
  <div><label for="email">E-mailadres</label><input id="email" name="email" type="email" autocomplete="username" value="${esc(email)}" required ${email ? '' : 'autofocus'}></div>
  <div><label for="password">Wachtwoord</label><input id="password" name="password" type="password" autocomplete="current-password" required ${email ? 'autofocus' : ''}></div>
  <button type="submit">Inloggen</button>
  <div class="note">Wachtwoord vergeten of nog geen account? Vraag je teamlead om een link.</div>
</form>${privacyLink}` });

export const codePage = ({ error } = {}) => page({ title: 'Code invoeren', body: `
<form method="post" action="/login/code" style="display:flex;flex-direction:column;gap:20px">
  <div><h1>Tweestapsverificatie</h1><p>Vul de 6-cijferige code uit je authenticator-app in.</p></div>
  ${msg(error)}
  <div><label for="code">Code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="20" required autofocus>
  <div class="hint">Telefoon kwijt? Vul dan een van je herstelcodes in.</div></div>
  <button type="submit">Inloggen</button>
</form>
<form method="post" action="/logout"><button type="submit" style="background:none;color:#5C5C5A;height:auto;font-size:13px;font-weight:500">Annuleren</button></form>` });

export const enrollPage = ({ error, secret, otpauth, name } = {}) => page({ title: 'Tweestapsverificatie instellen', body: `
<form method="post" action="/login/2fa-instellen" style="display:flex;flex-direction:column;gap:18px">
  <div><h1>Tweestapsverificatie instellen</h1><p>Voor jouw rol is een tweede stap verplicht, ${esc(name)}. Dit hoef je maar één keer te doen.</p></div>
  ${msg(error)}
  <ol>
    <li>Installeer een authenticator-app op je telefoon, bijvoorbeeld Google Authenticator, Microsoft Authenticator of 1Password.</li>
    <li>Scan deze QR-code met de app.</li>
  </ol>
  <img class="qr" src="${qrDataUrl(otpauth)}" alt="QR-code voor je authenticator-app">
  <div><div class="hint" style="margin:0 0 6px">Scannen lukt niet? Voer deze sleutel handmatig in:</div><div class="code">${esc(secret.match(/.{1,4}/g).join(' '))}</div></div>
  <div><label for="code">3. Vul de code uit de app in</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required></div>
  <button type="submit">Bevestigen</button>
</form>` });

export const recoveryPage = ({ codes, next = '/' }) => page({ title: 'Herstelcodes', body: `
<div><h1>Bewaar je herstelcodes</h1><p>Tweestapsverificatie staat aan. Ben je je telefoon kwijt? Dan kun je met een van deze codes inloggen. Elke code werkt één keer.</p></div>
<div class="codes">${codes.map(c => `<span>${esc(c)}</span>`).join('')}</div>
<div class="note">Bewaar ze op een veilige plek, bijvoorbeeld in je wachtwoordmanager. Je ziet ze maar één keer; nieuwe codes maak je onder Instellingen › Mijn account.</div>
<a class="btn" href="${esc(next)}">Ik heb ze bewaard, naar de app</a>` });

export const invitePage = ({ error, account, email = '', setup = false, action } = {}) => page({ title: setup ? 'Account instellen' : 'Uitnodiging', body: `
<form method="post" action="${esc(action)}" style="display:flex;flex-direction:column;gap:18px">
  <div><h1>${setup ? 'Dev-account instellen' : `Welkom, ${esc(account.name)}`}</h1>
  <p>${setup ? 'Dit is het eerste account van de Campagnemonitor. Het kan alles, ook integraties en rechten beheren.' : 'Je bent uitgenodigd voor de Campagnemonitor van Horeca Toppers. Kies je inloggegevens.'}</p></div>
  ${msg(error)}
  <div><label for="name">Naam</label><input id="name" value="${esc(account.name)}" readonly></div>
  <div><label for="email">E-mailadres</label><input id="email" name="email" type="email" autocomplete="username" value="${esc(email || account.email || '')}" required autofocus></div>
  <div><label for="password">Wachtwoord</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required><div class="hint">Minstens 12 tekens. Een zin van een paar woorden werkt goed.</div></div>
  <div><label for="password2">Herhaal wachtwoord</label><input id="password2" name="password2" type="password" autocomplete="new-password" minlength="12" required></div>
  <button type="submit">${setup ? 'Account aanmaken' : 'Account activeren'}</button>
  <p style="font-size:12px;color:#8C8C8A;margin:0">Door verder te gaan ga je akkoord met hoe we met je gegevens omgaan: zie <a href="/privacy">Privacy</a>.</p>
</form>` });

export const resetPage = ({ error, account, action } = {}) => page({ title: 'Nieuw wachtwoord', body: `
<form method="post" action="${esc(action)}" style="display:flex;flex-direction:column;gap:18px">
  <div><h1>Nieuw wachtwoord</h1><p>Kies een nieuw wachtwoord voor ${esc(account.email || account.name)}. Je wordt daarna overal uitgelogd.</p></div>
  ${msg(error)}
  <div><label for="password">Nieuw wachtwoord</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="12" required autofocus><div class="hint">Minstens 12 tekens.</div></div>
  <div><label for="password2">Herhaal wachtwoord</label><input id="password2" name="password2" type="password" autocomplete="new-password" minlength="12" required></div>
  <button type="submit">Wachtwoord opslaan</button>
</form>` });

export const messagePage = ({ title, text, link = '/login', linkLabel = 'Naar inloggen' }) => page({ title, body: `
<div><h1>${esc(title)}</h1><p>${esc(text)}</p></div>
<a class="btn" href="${esc(link)}">${esc(linkLabel)}</a>` });

export const privacyPage = ({ back = '/' } = {}) => page({ title: 'Privacy', wide: true, body: `
<div class="privacy" style="display:flex;flex-direction:column;gap:10px">
  <h1>Privacy in de Campagnemonitor</h1>
  <p class="note" style="margin:0">Concepttekst. Laat deze controleren door wie binnen Horeca Toppers verantwoordelijk is voor privacy, en vul de contactpersoon in.</p>
  <h2>Wat is dit?</h2>
  <p>De Campagnemonitor is een interne tool van Horeca Toppers. Het team houdt er wekelijkse campagnefeedback, de gezondheid van campagnes en de kandidatenpijplijn uit Trello in bij.</p>
  <h2>Welke gegevens bewaren we over teamleden?</h2>
  <ul>
    <li>Je naam, e-mailadres, rol en rechten.</li>
    <li>Je wachtwoord, alleen als onomkeerbare hash. Bij tweestapsverificatie een versleutelde sleutel en gehashte herstelcodes.</li>
    <li>Je sessies: wanneer je inlogde en welke browser je gebruikte, zodat je kunt zien waar je bent ingelogd en daar kunt uitloggen.</li>
    <li>Wat je in de app vastlegt, met je naam erbij: feedback, klantfeedback, toewijzingen, meldingen en ideeën.</li>
    <li>Een auditlog van beveiligingsgebeurtenissen (inloggen, rechten, sleutels, privacy-acties), met het IP-adres bij inlogpogingen.</li>
  </ul>
  <h2>En over kandidaten?</h2>
  <p>De app telt kaarten op de Trello-borden per lijst, label en week, en leest de afwijsreden. Namen, contactgegevens en beschrijvingen van kandidaten worden niet opgehaald of opgeslagen.</p>
  <h2>Waarom?</h2>
  <p>Om het werk van het team te organiseren (uitvoering van de arbeidsovereenkomst) en om de gegevens te beveiligen (gerechtvaardigd belang).</p>
  <h2>Hoe lang?</h2>
  <ul>
    <li>Sessies: maximaal 30 dagen. Uitnodigingslinks: 7 dagen. Resetlinks: 24 uur.</li>
    <li>Auditlog: 12 maanden.</li>
    <li>Back-ups van de data: 14 dagen.</li>
    <li>Na uitdiensttreding wordt je account gedeactiveerd en na de ingestelde termijn geanonimiseerd: je naam wordt overal vervangen door een pseudoniem.</li>
  </ul>
  <h2>Waar?</h2>
  <p>De app draait bij Render in Frankfurt (EU). Kandidaatgegevens blijven in Trello (Atlassian).</p>
  <h2>Je rechten</h2>
  <p>Je kunt je eigen gegevens downloaden onder Instellingen › Mijn account. Voor inzage, correctie of verwijdering kun je terecht bij [contactpersoon privacy, Horeca Toppers].</p>
  <a class="btn" href="${esc(back)}" style="margin-top:12px">Terug</a>
</div>` });
