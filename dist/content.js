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
  const data = await getStorage(["blocked", "snoozes"]);
  const blocked = data.blocked || {};
  const snoozes = data.snoozes || {};
  const now = Date.now();

  // If snoozed, and snooze not expired, do not redirect
  if (snoozes[domain] && snoozes[domain] > now) return;

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
    const blockedUrl = chrome.runtime.getURL("blocked.html");
    if (!location.href.startsWith(blockedUrl)) location.replace(blockedUrl);
  }
  if (msg && msg.action === "snoozed") {
    // optional: allow page to update UI if snoozed
    // msg.until contains timestamp when snooze ends
    // No action required here; checkAndRedirect will respect snoozes on load
  }
});

checkAndRedirect();
