// Content script: redirects to blocked page when domain is blocked

function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

async function checkAndRedirect() {
  const domain = domainFromUrl(location.href);
  if (!domain) return;
  const data = await getStorage(["blocked", "snoozes", "whitelist"]);
  const blocked = data.blocked || {};
  const snoozes = data.snoozes || {};
  const whitelist = data.whitelist || [];
  const now = Date.now();

  // If snoozed, and snooze not expired, do not redirect
  if (snoozes[domain] && snoozes[domain] > now) return;

  // If whitelisted, never redirect
  if (whitelist && whitelist.includes(domain)) return;

  // Ask background whether THIS TAB is in a per-tab grace period
  const tabGrace = await new Promise((res) => {
    try {
      chrome.runtime.sendMessage({ action: "is-tab-in-grace" }, (resp) => res(resp || { until: null }));
    } catch (e) {
      res({ until: null });
    }
  });
  if (tabGrace && tabGrace.until && tabGrace.until > now) return;

  const entry = blocked[domain];
  if (entry) {
    // entry can be true or an object with `until` timestamp
    const until = entry && entry.until ? entry.until : null;
    if (until && now > until) {
      // expired block -> allow
      return;
    }
    const blockedUrl = chrome.runtime.getURL("blocked.html");
    if (!location.href.startsWith(blockedUrl)) {
      location.replace(blockedUrl);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "redirect") {
    (async () => {
      const data = await getStorage(["whitelist", "snoozes"]);
      const whitelist = data.whitelist || [];
      const snoozes = data.snoozes || {};
      const now = Date.now();
      const domain = domainFromUrl(location.href);
      if (!domain) return;
      if (whitelist && whitelist.includes(domain)) return;
      if (snoozes[domain] && snoozes[domain] > now) return;
      const blockedUrl = chrome.runtime.getURL("blocked.html");
      if (!location.href.startsWith(blockedUrl)) location.replace(blockedUrl);
    })();
  }
  if (msg && msg.action === "snoozed") {
    // optional: allow page to update UI if snoozed
    // msg.until contains timestamp when snooze ends
    // No action required here; checkAndRedirect will respect snoozes on load
  }
});

checkAndRedirect();
