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
  const data = await getStorage(["blocked"]);
  const blocked = data.blocked || {};
  if (blocked[domain]) {
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
});

checkAndRedirect();
