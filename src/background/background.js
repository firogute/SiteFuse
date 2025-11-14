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

async function isNowInSchedule(schedule) {
  try {
    if (!schedule || !schedule.enabled) return false;
    const now = new Date();
    const day = now.getDay();
    if (
      Array.isArray(schedule.days) &&
      schedule.days.length &&
      !schedule.days.includes(day)
    )
      return false;
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const nowStr = pad(now.getHours()) + ":" + pad(now.getMinutes());
    const start = schedule.start || "00:00";
    const end = schedule.end || "23:59";
    if (start <= end) {
      return nowStr >= start && nowStr <= end;
    } else {
      // overnight schedule
      return nowStr >= start || nowStr <= end;
    }
  } catch (e) {
    return false;
  }
}

async function enforceSchedules() {
  try {
    const s = await getStorage([
      "schedules",
      "categories",
      "limits",
      "blocked",
    ]);
    const schedules = s.schedules || [];
    const categories = s.categories || {};
    const limits = s.limits || {};
    const blocked = s.blocked || {};
    for (const sch of schedules) {
      if (!sch.enabled) continue;
      const nowIn = await isNowInSchedule(sch);
      if (!nowIn) continue;
      if (sch.type === "domain") {
        const until = sch.until ? sch.until : null;
        blocked[sch.target] = blocked[sch.target] || {};
        if (
          !blocked[sch.target].until ||
          (until && blocked[sch.target].until < until)
        ) {
          // set temporary block until schedule end
          const endTs = (() => {
            if (sch.until) return sch.until;
            // compute next end time based on sch.end
            const now = new Date();
            const [h, m] = (sch.end || "23:59").split(":").map(Number);
            const end = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              h,
              m
            ).getTime();
            if (end < Date.now()) return end + 24 * 60 * 60 * 1000; // tomorrow
            return end;
          })();
          blocked[sch.target].until = endTs;
        }
      } else if (sch.type === "category") {
        // find domains in this category and block them temporarily
        for (const d of Object.keys(categories)) {
          if (categories[d] === sch.target) {
            blocked[d] = blocked[d] || {};
            const [h, m] = (sch.end || "23:59").split(":").map(Number);
            const now = new Date();
            let end = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              h,
              m
            ).getTime();
            if (end < Date.now()) end += 24 * 60 * 60 * 1000;
            blocked[d].until = end;
          }
        }
      }
    }
    await setStorage({ blocked });
    // notify content scripts of redirects where necessary
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        try {
          const d = domainFromUrl(t.url);
          if (d && blocked[d])
            chrome.tabs.sendMessage(t.id, { action: "redirect" }, () => {});
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// Evaluate and award gamification badges once per day (or on-demand).
async function evaluateBadges() {
  try {
    const mod = await import("../utils/storage.js");
    const { getStreaks, getBadges, awardBadge, getStreakCalendar } = mod;
    const streaks = await getStreaks();
    const badges = await getBadges();
    const toNotify = [];

    // First use badge
    if (!badges["first_use"]) {
      await awardBadge("first_use", {
        title: "First Steps",
        desc: "Installed SiteFuse and started tracking",
      });
      toNotify.push({ id: "first_use", title: "First Steps" });
    }

    // Streak-based badges
    if ((streaks.current || 0) >= 7 && !badges["7_day_streak"]) {
      await awardBadge("7_day_streak", {
        title: "7 Day Streak",
        desc: "Stayed under limits for 7 consecutive days",
      });
      toNotify.push({ id: "7_day_streak", title: "7 Day Streak" });
    }
    if ((streaks.current || 0) >= 14 && !badges["14_day_streak"]) {
      await awardBadge("14_day_streak", {
        title: "14 Day Streak",
        desc: "Stayed under limits for 14 consecutive days",
      });
      toNotify.push({ id: "14_day_streak", title: "14 Day Streak" });
    }
    if ((streaks.best || 0) >= 30 && !badges["30_day_best"]) {
      await awardBadge("30_day_best", {
        title: "30 Day Champion",
        desc: "Recorded a 30 day best streak",
      });
      toNotify.push({ id: "30_day_best", title: "30 Day Champion" });
    }

    // Consistency: last 7 days all-success
    try {
      const cal = await getStreakCalendar(7);
      const allGood =
        Array.isArray(cal) && cal.length > 0 && cal.every((c) => c.success);
      if (allGood && !badges["consistent_7"]) {
        await awardBadge("consistent_7", {
          title: "Consistent 7",
          desc: "All tracked sites under limit for the last 7 days",
        });
        toNotify.push({ id: "consistent_7", title: "Consistent 7" });
      }
    } catch (e) {
      // ignore calendar errors
    }

    // Send notifications for newly awarded badges
    for (const b of toNotify) {
      try {
        chrome.notifications.create(`sitefuse_badge_${b.id}`, {
          type: "basic",
          iconUrl: "/icon128.png",
          title: "Badge Unlocked!",
          message: b.title,
        });
      } catch (e) {
        // ignore notification errors
      }
    }
  } catch (e) {
    // swallow evaluation errors
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
    try {
      // clear progress notification when fully blocked
      chrome.notifications.clear(`sitefuse_progress_${domain}`);
    } catch (e) {}
    return;
  }
  await setStorage({ usage });

  // Send notifications at thresholds: 50%, 80%, 100% (100% handled above)
  try {
    if (limitMins) {
      const pct = (usage[domain] / (limitMins * 60)) * 100;
      // Show a live progress notification for this domain when above 10%
      try {
        if (pct >= 10) {
          const progressId = `sitefuse_progress_${domain}`;
          chrome.notifications.create(progressId, {
            type: "progress",
            iconUrl: "/icon128.png",
            title: `${domain} usage`,
            message: `${Math.round(pct)}% of limit used`,
            progress: Math.min(100, Math.round(pct)),
            buttons: [{ title: "Snooze 5m" }, { title: "Extend 10m" }],
          });
        }
      } catch (e) {}

      // One-off threshold nudges still useful — maintain previous behavior for 50/80
      const thresholds = [50, 80];
      for (const thr of thresholds) {
        const key = `notif_${thr}_${domain}`;
        const meta = await getStorage([key]);
        const sent = meta[key];
        if (pct >= thr && !sent) {
          try {
            chrome.notifications.create(
              `sitefuse_${thr}_${domain}`,
              {
                type: "basic",
                iconUrl: "/icon128.png",
                title: `SiteFuse: ${Math.round(pct)}% of limit reached`,
                message: `${domain} has used ${Math.round(
                  pct
                )}% of its time limit.`,
                buttons: [{ title: "Snooze 5m" }],
              },
              () => {}
            );
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
    // run badge evaluation once on install
    try {
      await evaluateBadges();
    } catch (e) {}
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
  // create a daily alarm to run badge evaluation and other daily maintenance
  try {
    // clear and recreate daily alarm
    chrome.alarms.clear("sitefuse_daily", () => {
      // 1440 minutes = 24 hours
      chrome.alarms.create("sitefuse_daily", { periodInMinutes: 1440 });
    });
  } catch (e) {
    // ignore daily alarm errors
  }
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
  if (alarm.name === "sitefuse_daily") {
    try {
      await evaluateBadges();
    } catch (e) {}
    return;
  }
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
  // enforce any configured schedules after updating usage
  try {
    await enforceSchedules();
  } catch (e) {}
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

// Focus mode: block categories/domains for a duration
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === "start-focus") {
    (async () => {
      try {
        const minutes = msg.minutes || 25;
        const until = Date.now() + minutes * 60 * 1000;
        const data = await getStorage(["categories"]);
        const categories = data.categories || {};
        const toBlock = new Set();
        if (msg.categories && msg.categories.length) {
          for (const d of Object.keys(categories)) {
            if (msg.categories.includes(categories[d])) toBlock.add(d);
          }
        }
        if (msg.domains && msg.domains.length) {
          for (const dd of msg.domains) toBlock.add(dd);
        }
        const b = (await getStorage(["blocked"])).blocked || {};
        for (const dom of toBlock) {
          b[dom] = { ...(b[dom] || {}), until };
        }
        await setStorage({ blocked: b });
        // redirect tabs
        chrome.tabs.query({}, (tabs) => {
          for (const t of tabs) {
            try {
              const d = domainFromUrl(t.url);
              if (d && b[d])
                chrome.tabs.sendMessage(t.id, { action: "redirect" }, () => {});
            } catch (e) {}
          }
        });
        sendResponse({ ok: true, until });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.action === "stop-focus") {
    (async () => {
      try {
        const b = (await getStorage(["blocked"])).blocked || {};
        const targets = msg.targets || [];
        for (const t of targets) delete b[t];
        await setStorage({ blocked: b });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});

// Handle notification button clicks (snooze)
if (chrome.notifications) {
  chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
    try {
      // support progress notifications with two quick actions
      if (notifId.startsWith("sitefuse_progress_")) {
        const domain = notifId.slice("sitefuse_progress_".length);
        if (btnIdx === 0) {
          // Snooze for 5 minutes
          const snoozeMinutes = 5;
          const data = await getStorage(["blocked", "snoozes"]);
          const snoozes = data.snoozes || {};
          snoozes[domain] = Date.now() + snoozeMinutes * 60 * 1000;
          await setStorage({ snoozes });
          chrome.tabs.query({}, (tabs) => {
            for (const t of tabs) {
              try {
                const d = domainFromUrl(t.url);
                if (d === domain)
                  chrome.tabs.sendMessage(
                    t.id,
                    { action: "snoozed", until: snoozes[domain] },
                    () => {}
                  );
              } catch (e) {}
            }
          });
          return;
        }
        if (btnIdx === 1) {
          // Extend the limit by 10 minutes
          const minutes = 10;
          const data = await getStorage(["limits"]);
          const limits = data.limits || {};
          limits[domain] = (limits[domain] || 0) + minutes;
          await setStorage({ limits });
          return;
        }
        return;
      }
      // notifId format: sitefuse_<threshold>_<domain>
      if (!notifId.startsWith("sitefuse_")) return;
      const parts = notifId.split("_");
      const domain = parts.slice(2).join("_");
      // Snooze for 5 minutes
      const snoozeMinutes = 5;
      const data = await getStorage(["blocked", "snoozes"]);
      const snoozes = data.snoozes || {};
      snoozes[domain] = Date.now() + snoozeMinutes * 60 * 1000;
      await setStorage({ snoozes });
      // clear any immediate redirection for that domain by sending message to tabs
      chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
          try {
            const d = domainFromUrl(t.url);
            if (d === domain)
              chrome.tabs.sendMessage(
                t.id,
                { action: "snoozed", until: snoozes[domain] },
                () => {}
              );
          } catch (e) {}
        }
      });
    } catch (e) {}
  });
}

// Add message handlers for export and snooze via messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === "export-csv") {
    (async () => {
      try {
        const { exportAllToCSV } = await import("../utils/storage.js");
        const csv = await exportAllToCSV();
        sendResponse({ ok: true, csv });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
  if (msg.action === "snooze") {
    (async () => {
      const domain = msg.domain;
      const mins = msg.minutes || 5;
      const data = await getStorage(["snoozes"]);
      const snoozes = data.snoozes || {};
      snoozes[domain] = Date.now() + mins * 60 * 1000;
      await setStorage({ snoozes });
      sendResponse({ ok: true, until: snoozes[domain] });
    })();
    return true;
  }
  if (msg.action === "evaluate-badges") {
    (async () => {
      try {
        await evaluateBadges();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
