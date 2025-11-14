// Background service worker for SiteFuse (MV3)
// Tracks active domain and increments usage every minute via chrome.alarms

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return null;
  }
}

function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setStorage(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function setCurrentDomain(domain) {
  await setStorage({ currentDomain: domain });
}

async function getCurrentDomain() {
  const r = await getStorage(["currentDomain"]);
  return r.currentDomain || null;
}

async function incrementDomainUsage(domain, seconds = 60) {
  if (!domain) return;
  const data = await getStorage(["usage", "limits", "blocked"]);
  const usage = data.usage || {};
  const limits = data.limits || {};
  const blocked = data.blocked || {};

  usage[domain] = (usage[domain] || 0) + seconds;

  // maintain a simple usage history for trends
  try {
    const histData = await getStorage(["usageHistory"]);
    const usageHistory = histData.usageHistory || {};
    if (!usageHistory[domain]) usageHistory[domain] = [];
    usageHistory[domain].push({ t: Date.now(), s: seconds });
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days
    usageHistory[domain] = usageHistory[domain].filter((e) => e.t >= cutoff);
    await setStorage({ usageHistory });
  } catch (e) {
    // ignore history errors
  }

  const limitMins = limits[domain];
  if (limitMins && usage[domain] >= limitMins * 60) {
    blocked[domain] = true;
    await setStorage({ usage, blocked });
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        try {
          const d = domainFromUrl(t.url);
          if (d === domain) {
            chrome.tabs.sendMessage(t.id, { action: "redirect" }, () => {});
          }
        } catch (e) {}
      }
    });
    return;
  }

  await setStorage({ usage });
  // Send a notification when hitting 80% of limit
  try {
    const limitMins = limits[domain];
    if (limitMins) {
      const pct = (usage[domain] / (limitMins * 60)) * 100;
      const notifKey = `notif_${domain}`;
      const meta = await getStorage([notifKey]);
      const sent = meta[notifKey];
      if (pct >= 80 && !sent) {
        try {
          chrome.notifications.create(
            `sitefuse_warn_${domain}`,
            {
              type: "basic",
              iconUrl: "/icon128.png",
              title: "SiteFuse: approaching limit",
              message: `${domain} has used ${Math.round(
                pct
              )}% of its time limit.`,
            },
            () => {}
          );
        } catch (e) {}
        const obj = {};
        obj[notifKey] = true;
        await setStorage(obj);
      }
    }
  } catch (e) {}
}

async function updateActiveTabDomain() {
  try {
    const [tab] = await new Promise((resolve) =>
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve)
    );
    if (tab && tab.url) {
      const domain = domainFromUrl(tab.url);
      await setCurrentDomain(domain);
    } else {
      await setCurrentDomain(null);
    }
  } catch (e) {
    await setCurrentDomain(null);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    const data = await getStorage(["debug"]);
    const debug = !!data.debug;
    // initialize storage keys
    await setStorage({ usage: {}, limits: {}, blocked: {}, debug });
    setupAlarm(debug);
  })();
});

function setupAlarm(debug) {
  // clear existing
  chrome.alarms.clear("sitefuse_tick", () => {
    const minutes = debug ? 5 / 60 : 1; // 5 seconds if debug (may be clamped by browser)
    try {
      chrome.alarms.create("sitefuse_tick", { periodInMinutes: minutes });
    } catch (e) {
      // fallback to 1 minute if invalid
      chrome.alarms.create("sitefuse_tick", { periodInMinutes: 1 });
    }
  });
}

// Watch debug setting changes to reconfigure alarm
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.debug) {
    const debug = !!changes.debug.newValue;
    setupAlarm(debug);
  }
});

chrome.tabs.onActivated.addListener(updateActiveTabDomain);
chrome.windows.onFocusChanged.addListener((winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) {
    setCurrentDomain(null);
  } else {
    updateActiveTabDomain();
  }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") updateActiveTabDomain();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "sitefuse_tick") return;
  const domain = await getCurrentDomain();
  if (!domain) return;
  const d = await getStorage(["debug"]);
  const debug = !!d.debug;
  const seconds = debug ? 5 : 60;
  await incrementDomainUsage(domain, seconds);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "block-now") {
    (async () => {
      const domain = msg.domain;
      const data = await getStorage(["blocked"]);
      const blocked = data.blocked || {};
      blocked[domain] = true;
      await setStorage({ blocked });
      chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
          try {
            const d = domainFromUrl(t.url);
            if (d === domain)
              chrome.tabs.sendMessage(t.id, { action: "redirect" }, () => {});
          } catch (e) {}
        }
      });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg && msg.action === "unblock") {
    (async () => {
      const domain = msg.domain;
      const data = await getStorage(["blocked"]);
      const blocked = data.blocked || {};
      delete blocked[domain];
      await setStorage({ blocked });
      sendResponse({ ok: true });
    })();
    return true;
  }
});
