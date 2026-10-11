/* Small helpers shared by all pages: (1) study timer, (2) class page note autosave + chat. */

/* ---------- 1. Study timer (25 min). Survives page changes via sessionStorage ---------- */
(function () {
  const KEY = 'studyEnd';
  const LENGTH = 25 * 60 * 1000;
  const pill = document.getElementById('study-pill');
  const buttons = document.querySelectorAll('[data-study-btn]');
  let tick = null;

  function render() {
    const left = Number(sessionStorage.getItem(KEY) || 0) - Date.now();
    if (left <= 0) { stop(true); return; }
    const m = String(Math.floor(left / 60000)).padStart(2, '0');
    const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    pill.textContent = 'Study ' + m + ':' + s;
  }
  function run() {
    pill.hidden = false;
    buttons.forEach(b => (b.textContent = 'Stop studying'));
    render();
    tick = setInterval(render, 1000);
  }
  function stop(finished) {
    sessionStorage.removeItem(KEY);
    clearInterval(tick);
    pill.hidden = true;
    buttons.forEach(b => (b.textContent = b.dataset.label));
    if (finished) alert('Study session complete. Take a 5 minute break.');
  }

  buttons.forEach(b => b.addEventListener('click', () => {
    if (sessionStorage.getItem(KEY)) { stop(false); }
    else { sessionStorage.setItem(KEY, Date.now() + LENGTH); run(); }
  }));
  if (Number(sessionStorage.getItem(KEY) || 0) > Date.now()) run();
})();

/* ---------- 2. Class page: autosave note + chat ---------- */
(function () {
  const app = document.getElementById('class-app');
  if (!app) return;

  const ctx = { folder: app.dataset.folder, class: app.dataset.class, unit: app.dataset.unit };
  const editor = document.getElementById('note-editor');   // null on the Import panel
  const status = document.getElementById('save-status');
  const log = document.getElementById('chat-log');
  let saveTimer = null;

  async function post(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    try {
      const out = await post(app.dataset.noteUrl, { ...ctx, content: editor.value });
      status.textContent = out.ok ? 'Saved' : 'Save failed';
    } catch (e) {
      status.textContent = 'Save failed';
    }
  }

  if (editor) {
    editor.addEventListener('input', () => {
      status.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, 500);   // wait until typing pauses
    });
  }

  function addBubble(role, text) {
    const empty = document.getElementById('chat-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'bubble ' + role;
    div.textContent = text;                    // textContent: never inject HTML
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    addBubble('user', message);
    try {
      if (editor) await saveNow();             // make sure the bot sees the latest note
      const out = await post(app.dataset.chatUrl, { ...ctx, message });
      addBubble('bot', out.ok ? out.reply : 'Something went wrong. Try again.');
    } catch (err) {
      addBubble('bot', 'Could not reach the server. Try again.');
    }
  });

  log.scrollTop = log.scrollHeight;
})();