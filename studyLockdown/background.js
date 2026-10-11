// Cadence Study Lockdown: background service worker.
// While a lock is active, the Cadence tab is the only tab/window allowed in this Chrome profile.

const LOCK_KEY = 'cadenceLock';
const ALARM_NAME = 'cadence-lock-expire';
const MAX_LOCK_MS = 3 * 60 * 60 * 1000; // hard cap so a lock can never get stuck

async function getLock() {
  const { [LOCK_KEY]: lock } = await chrome.storage.local.get(LOCK_KEY);
  if (lock && Date.now() > lock.endsAt) {
    await clearLock();
    return null;
  }
  return lock || null;
}

async function clearLock() {
  await chrome.storage.local.remove(LOCK_KEY);
  await chrome.alarms.clear(ALARM_NAME);
}

// ---- Messages from the page (via content.js) ----
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab) return;

  if (msg.type === 'START') {
    const requested = Number(msg.endsAt) || Date.now() + 30 * 60 * 1000;
    const endsAt = Math.min(requested, Date.now() + MAX_LOCK_MS);
    chrome.storage.local
      .set({
        [LOCK_KEY]: {
          tabId: sender.tab.id,
          windowId: sender.tab.windowId,
          origin: msg.origin,
          endsAt,
        },
      })
      .then(() => chrome.alarms.create(ALARM_NAME, { when: endsAt }));
  }

  if (msg.type === 'STOP') {
    getLock().then((lock) => {
      if (lock && lock.tabId === sender.tab.id) clearLock();
    });
  }
});

// ---- Enforcement ----

// Switching to any other tab (in any window) snaps back to the study tab
chrome.tabs.onActivated.addListener(async (info) => {
  const lock = await getLock();
  if (!lock || info.tabId === lock.tabId) return;
  try {
    await chrome.tabs.update(lock.tabId, { active: true });
    await chrome.windows.update(lock.windowId, { focused: true });
  } catch (e) {}
});

// New tabs are closed immediately
chrome.tabs.onCreated.addListener(async (tab) => {
  const lock = await getLock();
  if (!lock || tab.id === lock.tabId) return;
  try {
    await chrome.tabs.remove(tab.id);
  } catch (e) {}
});

// New windows are closed immediately
chrome.windows.onCreated.addListener(async (win) => {
  const lock = await getLock();
  if (!lock || win.id === lock.windowId) return;
  try {
    await chrome.windows.remove(win.id);
  } catch (e) {}
});

// Clicking into a different Chrome window pulls focus back
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const lock = await getLock();
  if (!lock || windowId === chrome.windows.WINDOW_ID_NONE || windowId === lock.windowId) return;
  try {
    await chrome.windows.update(lock.windowId, { focused: true });
  } catch (e) {}
});

// If the study tab navigates to another site, send it back
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const lock = await getLock();
  if (!lock || tabId !== lock.tabId) return;
  try {
    if (new URL(changeInfo.url).origin !== lock.origin) await chrome.tabs.goBack(tabId);
  } catch (e) {}
});

// If the study tab is closed, release the lock so nothing gets stuck
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const lock = await getLock();
  if (lock && lock.tabId === tabId) await clearLock();
});

// Failsafe expiry
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) clearLock();
});
