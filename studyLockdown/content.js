// Bridges messages between the Cadence page and the extension's background worker.
// The page never gets direct access to the extension; it only posts START / STOP / PING.

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data;
  if (!data || data.source !== 'cadence-lockdown') return;

  if (data.type === 'PING') {
    window.postMessage({ source: 'cadence-extension', type: 'PONG' }, location.origin);
    return;
  }

  if (data.type === 'START' || data.type === 'STOP') {
    chrome.runtime
      .sendMessage({ type: data.type, endsAt: data.endsAt, origin: location.origin })
      .catch(() => {});
  }
});

// Announce presence on load so the page can show "Chrome lock on"
window.postMessage({ source: 'cadence-extension', type: 'PONG' }, location.origin);
