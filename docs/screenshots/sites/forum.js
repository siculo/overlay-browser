// Il forum d'esempio dei percorsi che non possono usare un sito vero
// (accedere-ai-siti: il login; link-e-menu: link, immagini e campi di testo
// sempre uguali). Servito da serveSite() (run.js) sul dominio riservato agli
// esempi forum.example: nella guida va detto che è un sito d'esempio.
//   pagine: /            il forum (accesso, discussioni con link che si
//                        aprono in un nuovo tab)
//           /accedi      la finestra di accesso (window.open con le
//                        dimensioni, come i login veri)
//           /discussione una discussione: link a un altro sito, un'immagine,
//                        un campo per rispondere
//           /rovine      un'altra discussione

const HOST = 'forum.example';
const URL = `https://${HOST}/`;
const STEAM_GUIDES = 'https://steamcommunity.com/app/2198150/guides/';

const STYLE = `<style>
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f4efe6; color: #2d2a26; }
  header { padding: 14px 28px; background: #5b7f4a; color: #fff; display: flex; align-items: center; gap: 16px; }
  header h1 { margin: 0; font-size: 20px; flex: 1; }
  header a { color: inherit; text-decoration: none; }
  header .tag { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: rgba(255,255,255,.2); }
  main { max-width: 760px; margin: 28px auto; padding: 0 24px; }
  .card { background: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .card h2 { margin: 0 0 6px; font-size: 18px; }
  .card h2 a { color: #2d4f9e; text-decoration: none; }
  .muted { color: #7a736a; font-size: 14px; }
  a { color: #2d4f9e; }
  button { font: inherit; padding: 8px 16px; border-radius: 6px; border: 1px solid #c9c2b6; background: #fff; cursor: pointer; }
  button.primary { background: #3d6ad6; border-color: #3d6ad6; color: #fff; font-weight: 600; }
  label { display: block; margin: 12px 0 4px; font-size: 14px; }
  input, textarea { width: 100%; box-sizing: border-box; font: inherit; padding: 8px 10px; border: 1px solid #c9c2b6; border-radius: 6px; }
</style>`;

const page = (title, body, script = '') => `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${title}</title>${STYLE}</head><body>
<header><h1><a href="/">Forum di Tiny Glade</a></h1><span class="tag">sito d'esempio</span><span id="account"></span></header>
<main>${body}</main>
<script>
  const user = document.cookie.match(/(?:^|; )utente=([^;]*)/)?.[1];
  if (user) document.getElementById('account').textContent = 'Ciao, ' + decodeURIComponent(user);
  ${script}
</script></body></html>`;

// Un'immagine della discussione: un ponte di pietra su un fiume.
const BRIDGE = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
  <rect width="320" height="160" fill="#bcd9ee"/><rect y="110" width="320" height="50" fill="#5d9bd1"/>
  <rect y="96" width="70" height="64" fill="#7fae5a"/><rect x="250" y="96" width="70" height="64" fill="#7fae5a"/>
  <path d="M50 96 H270 V112 H230 A70 50 0 0 0 90 112 H50 Z" fill="#a89a86" stroke="#6e6252" stroke-width="2"/>
  <circle cx="270" cy="34" r="16" fill="#f5d76e"/></svg>`;

const PAGES = {
  '/': page('Forum di Tiny Glade', `
  <div class="card" id="login-card"><h2>Partecipa alle discussioni</h2>
    <p class="muted">Per scrivere nel forum accedi con il tuo account.</p>
    <button class="primary" id="login">Continua con un account</button></div>
  <div class="card"><h2><a id="topic" href="/discussione" target="_blank">Come si costruisce un ponte sul fiume?</a></h2><p class="muted">12 risposte · ultima 2 ore fa</p></div>
  <div class="card"><h2><a href="/rovine" target="_blank">Le vostre rovine più romantiche</a></h2><p class="muted">48 risposte · ultima ieri</p></div>
  <div class="card"><h2><a href="/rovine" target="_blank">Pecore: quante sono troppe?</a></h2><p class="muted">7 risposte · ultima 3 giorni fa</p></div>`, `
  if (user) document.getElementById('login-card').innerHTML = '<h2>Bentornato!</h2><p class="muted">Hai effettuato l\\'accesso: ora puoi scrivere nel forum.</p>';
  document.getElementById('login')?.addEventListener('click', () =>
    window.open('/accedi', 'accedi', 'width=420,height=440'));
  window.addEventListener('message', (e) => { if (e.data === 'accesso') location.reload(); });`),

  '/accedi': `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Accedi al forum</title>${STYLE}</head><body>
<main style="margin:20px auto">
  <h2 style="margin:0 0 4px">Accedi</h2>
  <p class="muted">Usa l'account del forum di Tiny Glade.</p>
  <label for="email">Email</label><input id="email" value="giocatore@example.com">
  <label for="pwd">Password</label><input id="pwd" type="password" value="password">
  <p><button class="primary" id="ok">Accedi</button></p>
</main>
<script>
  document.getElementById('ok').onclick = () => {
    document.cookie = 'utente=Giocatore; path=/; max-age=86400';
    window.opener?.postMessage('accesso', '*');
    window.close();
  };
</script></body></html>`,

  '/discussione': page('Come si costruisce un ponte sul fiume? · Forum di Tiny Glade', `
  <div class="card"><h2>Come si costruisce un ponte sul fiume?</h2>
    <p class="muted">Aperta da <strong>Muratore</strong> · 12 risposte</p>
    <p id="text">Trascina un muro da una sponda all'altra del fiume: il gioco lo trasforma da solo in un ponte, con gli archi. Qui sotto il mio.</p>
    <p><img id="picture" src="/ponte.svg" width="320" height="160" alt="Un ponte di pietra sul fiume"></p>
    <p>Altre idee nelle <a id="external" href="${STEAM_GUIDES}" target="_blank">guide della comunità su Steam</a>
      e nella discussione <a id="other" href="/rovine" target="_blank">Le vostre rovine più romantiche</a>.</p></div>
  <div class="card"><label for="reply">Rispondi</label><textarea id="reply" rows="3">Bellissimo! Come hai fatto gli archi?</textarea></div>`),

  '/ponte.svg': { type: 'image/svg+xml', body: BRIDGE },

  '/rovine': page('Le vostre rovine più romantiche · Forum di Tiny Glade', `
  <div class="card"><h2>Le vostre rovine più romantiche</h2><p class="muted">Aperta da <strong>Pecorella</strong> · 48 risposte</p>
    <p>Mostrate le vostre rovine coperte d'edera!</p></div>`),
};

module.exports = { HOST, URL, STEAM_GUIDES, PAGES };
