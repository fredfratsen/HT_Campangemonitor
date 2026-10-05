// A minimal SMTP server for the tests: no TLS, accepts any login except the password 'fout', and keeps the mails
// it gets as { to: [addresses], data } with the headers unfolded and the quoted-printable body decoded (as bytes).
import net from 'node:net';

function readable(s) {
  const i = s.indexOf('\r\n\r\n'), head = s.slice(0, i), body = s.slice(i);
  return head.replace(/\r\n(?=[ \t])/g, '') + body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

export function fakeSmtp() {
  const mails = [];
  const server = net.createServer(sock => {
    let buf = '', data = null, mail = null, auth = null;
    const say = s => sock.write(s + '\r\n');
    const login = pass => say(pass === 'fout' ? '535 Authentication failed' : '235 OK');
    say('220 fake ESMTP');
    sock.on('error', () => {});
    sock.on('data', chunk => {
      buf += chunk;
      for (let i; (i = buf.indexOf('\r\n')) >= 0;) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') { mails.push({ to: mail.to, data: readable(data.join('\r\n')) }); data = null; say('250 OK'); }
          else data.push(line.startsWith('..') ? line.slice(1) : line);
          continue;
        }
        if (auth === 'plain') { auth = null; login(Buffer.from(line, 'base64').toString().split('\0')[2]); continue; }
        if (auth === 'user') { auth = 'pass'; say('334 UGFzc3dvcmQ6'); continue; }
        if (auth === 'pass') { auth = null; login(Buffer.from(line, 'base64').toString()); continue; }
        const [cmd, arg, initial] = line.split(' '), c = cmd.toUpperCase();
        if (c === 'EHLO') sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (c === 'AUTH' && arg.toUpperCase() === 'PLAIN') { if (initial) login(Buffer.from(initial, 'base64').toString().split('\0')[2]); else { auth = 'plain'; say('334 '); } }
        else if (c === 'AUTH') { auth = 'user'; say('334 VXNlcm5hbWU6'); }
        else if (c === 'MAIL') { mail = { to: [] }; say('250 OK'); }
        else if (c === 'RCPT') { mail.to.push(/<([^>]*)>/.exec(line)[1]); say('250 OK'); }
        else if (c === 'DATA') { data = []; say('354 Go ahead'); }
        else if (c === 'QUIT') { say('221 Bye'); sock.end(); }
        else say('250 OK');
      }
    });
  });
  return {
    mails,
    listen: () => new Promise(res => server.listen(0, '127.0.0.1', () => res(server.address().port))),
    close: () => new Promise(res => { server.close(res); server.closeAllConnections?.(); }),
  };
}
