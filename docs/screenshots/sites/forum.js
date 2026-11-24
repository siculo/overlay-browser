// Il forum d'esempio dei percorsi che non possono usare un sito vero
// (signing-in: il login; links-and-menu: link, immagini e campi di testo
// sempre uguali). Servito da serveSite() (run.js) sul dominio riservato agli
// esempi forum.example: nella guida va detto che è un sito d'esempio.
// I testi sono nella lingua delle schermate (tr() di run.js): le pagine si
// costruiscono con pages(), il nome del forum con title().
//   pagine: /            il forum (accesso, discussioni con link che si
//                        aprono in un nuovo tab)
//           /accedi      la finestra di accesso (window.open con le
//                        dimensioni, come i login veri)
//           /discussione una discussione (percorsi tradotti: forum.topicPath, forum.ruinsPath): link a un altro sito, un'immagine,
//                        un campo per rispondere
//           /rovine      un'altra discussione

const HOST = 'forum.example';
const URL = `https://${HOST}/`;
const STEAM_GUIDES = 'https://steamcommunity.com/app/2198150/guides/';
// run.js richiede questo modulo solo attraverso i percorsi: niente ciclo.
const { tr, lang } = require('../run');

const title = () => tr('forum.title');
// I percorsi delle discussioni, che si vedono nell'indirizzo.
const topicUrl = () => URL + tr('forum.topicPath').slice(1);

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

const page = (pageTitle, body, script = '') => `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8"><title>${pageTitle}</title>${STYLE}</head><body>
<header><h1><a href="/">${title()}</a></h1><span class="tag">${tr('forum.tag')}</span><span id="account"></span></header>
<main>${body}</main>
<script>
  const user = document.cookie.match(/(?:^|; )utente=([^;]*)/)?.[1];
  if (user) document.getElementById('account').textContent = ${JSON.stringify(tr('forum.hi'))} + decodeURIComponent(user);
  ${script}
</script></body></html>`;

// Un'immagine della discussione: un ponte di pietra su un fiume.
const BRIDGE = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">
  <rect width="320" height="160" fill="#bcd9ee"/><rect y="110" width="320" height="50" fill="#5d9bd1"/>
  <rect y="96" width="70" height="64" fill="#7fae5a"/><rect x="250" y="96" width="70" height="64" fill="#7fae5a"/>
  <path d="M50 96 H270 V112 H230 A70 50 0 0 0 90 112 H50 Z" fill="#a89a86" stroke="#6e6252" stroke-width="2"/>
  <circle cx="270" cy="34" r="16" fill="#f5d76e"/></svg>`;

const pages = () => {
  const topic = tr('forum.topic');
  const ruins = tr('forum.ruins');
  const sheep = tr('forum.sheep');
  return {
    '/': page(title(), `
  <div class="card" id="login-card"><h2>${tr('forum.join')}</h2>
    <p class="muted">${tr('forum.joinText')}</p>
    <button class="primary" id="login">${tr('forum.continue')}</button></div>
  <div class="card"><h2><a id="topic" href="${tr('forum.topicPath')}" target="_blank">${topic}</a></h2><p class="muted">${tr('forum.topicMeta')}</p></div>
  <div class="card"><h2><a href="${tr('forum.ruinsPath')}" target="_blank">${ruins}</a></h2><p class="muted">${tr('forum.ruinsMeta')}</p></div>
  <div class="card"><h2><a href="${tr('forum.ruinsPath')}" target="_blank">${sheep}</a></h2><p class="muted">${tr('forum.sheepMeta')}</p></div>`, `
  if (user) document.getElementById('login-card').innerHTML = ${JSON.stringify(`<h2>${tr('forum.welcome')}</h2><p class="muted">${tr('forum.welcomeText')}</p>`)};
  document.getElementById('login')?.addEventListener('click', () =>
    window.open('/accedi', 'accedi', 'width=420,height=440'));
  window.addEventListener('message', (e) => { if (e.data === 'accesso') location.reload(); });`),

    '/accedi': `<!doctype html><html lang="${lang()}"><head><meta charset="utf-8"><title>${tr('forum.signInTitle')}</title>${STYLE}</head><body>
<main style="margin:20px auto">
  <h2 style="margin:0 0 4px">${tr('forum.signIn')}</h2>
  <p class="muted">${tr('forum.signInText')}</p>
  <label for="email">Email</label><input id="email" value="${tr('forum.email')}@example.com">
  <label for="pwd">Password</label><input id="pwd" type="password" value="password">
  <p><button class="primary" id="ok">${tr('forum.signIn')}</button></p>
</main>
<script>
  document.getElementById('ok').onclick = () => {
    document.cookie = 'utente=${tr('forum.user')}; path=/; max-age=86400';
    window.opener?.postMessage('accesso', '*');
    window.close();
  };
</script></body></html>`,

    [tr('forum.topicPath')]: page(`${topic} · ${title()}`, `
  <div class="card"><h2>${topic}</h2>
    <p class="muted">${tr('forum.topicBy')}</p>
    <p id="text">${tr('forum.topicText')}</p>
    <p><img id="picture" src="/ponte.svg" width="320" height="160" alt="${tr('forum.pictureAlt')}"></p>
    <p>${tr('forum.moreIdeas')} <a id="external" href="${STEAM_GUIDES}" target="_blank">${tr('forum.steamGuides')}</a>
      ${tr('forum.andThread')} <a id="other" href="${tr('forum.ruinsPath')}" target="_blank">${ruins}</a>.</p></div>
  <div class="card"><label for="reply">${tr('forum.reply')}</label><textarea id="reply" rows="3">${tr('forum.replyText')}</textarea></div>`),

    '/ponte.svg': { type: 'image/svg+xml', body: BRIDGE },

    [tr('forum.ruinsPath')]: page(`${ruins} · ${title()}`, `
  <div class="card"><h2>${ruins}</h2><p class="muted">${tr('forum.ruinsBy')}</p>
    <p>${tr('forum.ruinsText')}</p></div>`),
  };
};

module.exports = { HOST, URL, STEAM_GUIDES, pages, title, topicUrl };
