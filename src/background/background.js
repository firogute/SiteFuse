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

  // Send notifications at thresholds: 50%, 80%, 100% (100% handled above)
  try {
    if (limitMins) {
      const pct = (usage[domain] / (limitMins * 60)) * 100;
      const thresholds = [50, 80];
      for (const thr of thresholds) {
        const key = `notif_${thr}_${domain}`;
        const meta = await getStorage([key]);
        const sent = meta[key];
        if (pct >= thr && !sent) {
          try {
            chrome.notifications.create(`sitefuse_${thr}_${domain}`, {
              type: 'basic',
              iconUrl: '/icon128.png',
              title: `SiteFuse: ${Math.round(pct)}% of limit reached`,
              message: `${domain} has used ${Math.round(pct)}% of its time limit.`,
              buttons: [{ title: 'Snooze 5m' }],
            }, () => {});
          } catch (e) {}
          const obj = {};
          obj[key] = true;
          await setStorage(obj);
        }
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
  // Aggregate usage across open tabs (sums per-domain, respects multiple tabs)
  const d = await getStorage(["debug"]);
  const debug = !!d.debug;
  const seconds = debug ? 5 : 60;
  try {
    chrome.tabs.query({}, async (tabs) => {
      const counts = {};
      for (const t of tabs) {
        try {
          if (!t.url) continue;
          const dom = domainFromUrl(t.url);
          if (!dom) continue;
          counts[dom] = (counts[dom] || 0) + 1;
        } catch (e) {}
      }
      // For each domain, increment usage by seconds * count
      for (const dom of Object.keys(counts)) {
        // check if domain is snoozed or blocked with until in the past
        await incrementDomainUsage(dom, seconds * counts[dom]);
      }
    });
  } catch (e) {
    // fallback: increment current domain only
    const domain = await getCurrentDomain();
    if (domain) await incrementDomainUsage(domain, seconds);
  }
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

// Handle notification button clicks (snooze)
if (chrome.notifications) {
  chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
    try {
      // notifId format: sitefuse_<threshold>_<domain>
      if (!notifId.startsWith('sitefuse_')) return;
      const parts = notifId.split('_');
      const domain = parts.slice(2).join('_');
      // Snooze for 5 minutes
      const snoozeMinutes = 5;
      const data = await getStorage(['blocked', 'snoozes']);
      const snoozes = data.snoozes || {};
      snoozes[domain] = Date.now() + snoozeMinutes * 60 * 1000;
      await setStorage({ snoozes });
      // clear any immediate redirection for that domain by sending message to tabs
      chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
          try {
            const d = domainFromUrl(t.url);
            if (d === domain) chrome.tabs.sendMessage(t.id, { action: 'snoozed', until: snoozes[domain] }, () => {});
          } catch (e) {}
        }
      });
    } catch (e) {}
  });
}

// Add message handlers for export and snooze via messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'export-csv') {
    (async () => {
      try {
        const { exportAllToCSV } = await import('../utils/storage.js');
        const csv = await exportAllToCSV();
        sendResponse({ ok: true, csv });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.action === 'snooze') {
    (async () => {
      const domain = msg.domain;
      const mins = msg.minutes || 5;
      const data = await getStorage(['snoozes']);
      const snoozes = data.snoozes || {};
      snoozes[domain] = Date.now() + mins * 60 * 1000;
      await setStorage({ snoozes });
      sendResponse({ ok: true, until: snoozes[domain] });
    })();
    return true;
  }
});
