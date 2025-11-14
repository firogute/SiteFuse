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
      "whitelist",
    ]);
    const schedules = s.schedules || [];
    const categories = s.categories || {};
    const limits = s.limits || {};
    const blocked = s.blocked || {};
    const whitelist = s.whitelist || [];
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
    // notify tabs of redirects where necessary (navigate them to blocked page)
    chrome.tabs.query({}, (tabs) => {
      const blockedUrl = chrome.runtime.getURL("blocked.html");
      for (const t of tabs) {
        try {
          const d = domainFromUrl(t.url);
          if (d && blocked[d] && !(whitelist && whitelist.includes(d))) {
            try {
              chrome.tabs.update(t.id, {
                url: `${blockedUrl}?fromTab=${t.id}&domain=${encodeURIComponent(
                  d
                )}`,
              });
            } catch (e) {
              // fallback: message content script to redirect
              try {
                chrome.tabs.sendMessage(t.id, { action: "redirect" }, () => {});
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// Evaluate and award gamification badges once per day (or on-demand).
async function evaluateBadges() {
  try {
    const mod = await import("../utils/storage.js");
    const { getStreaks, getBadges, awardBadge, getStreakCalendar, addCoins } =
      mod;
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
      try {
        await addCoins(10);
      } catch (e) {}
    }

    // Streak-based badges
    if ((streaks.current || 0) >= 7 && !badges["7_day_streak"]) {
      await awardBadge("7_day_streak", {
        title: "7 Day Streak",
        desc: "Stayed under limits for 7 consecutive days",
      });
      toNotify.push({ id: "7_day_streak", title: "7 Day Streak" });
      try {
        await addCoins(20);
      } catch (e) {}
    }
    if ((streaks.current || 0) >= 14 && !badges["14_day_streak"]) {
      await awardBadge("14_day_streak", {
        title: "14 Day Streak",
        desc: "Stayed under limits for 14 consecutive days",
      });
      toNotify.push({ id: "14_day_streak", title: "14 Day Streak" });
      try {
        await addCoins(40);
      } catch (e) {}
    }
    if ((streaks.best || 0) >= 30 && !badges["30_day_best"]) {
      await awardBadge("30_day_best", {
        title: "30 Day Champion",
        desc: "Recorded a 30 day best streak",
      });
      toNotify.push({ id: "30_day_best", title: "30 Day Champion" });
      try {
        await addCoins(80);
      } catch (e) {}
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
        try {
          await addCoins(25);
        } catch (e) {}
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

// Auto-adjust limits based on recent trends (run daily)
async function autoAdjustLimits() {
  try {
    const data = await getStorage(["limits", "usageHistory"]);
    const limits = data.limits || {};
    const usageHistory = data.usageHistory || {};
    const updated = {};
    for (const domain of Object.keys(usageHistory)) {
      const items = usageHistory[domain] || [];
      // compute daily totals over the last 7 days approximate from timestamps
      // fallback: sum recent entries for a heuristic
      const totalMinutes = Math.round(
        items.reduce((s, e) => s + (e.s || 0), 0) / 60
      );
      const current = limits[domain] || 15;
      // if user consistently exceeds limit, nudge down (stricter), else relax slightly
      if (totalMinutes > current * 1.3) {
        updated[domain] = Math.max(5, Math.round(current * 0.9));
      } else if (totalMinutes < current * 0.5) {
        updated[domain] = Math.min(240, Math.round(current * 1.1));
      }
    }
    if (Object.keys(updated).length) {
      // merge into limits and notify user of adjustments
      for (const d of Object.keys(updated)) limits[d] = updated[d];
      await setStorage({ limits });
      try {
        chrome.notifications.create("sitefuse_auto_adjust", {
          type: "basic",
          iconUrl: "/icon128.png",
          title: "Smart Limits Updated",
          message:
            "SiteFuse adjusted a few limits based on your recent trends.",
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// Create an updating countdown/progress notification for a domain for given milliseconds
const _countdownTimers = {};
function showCountdownNotification(domain, ms) {
  try {
    const id = `sitefuse_countdown_${domain}_${Date.now()}`;
    const total = Math.max(1, ms);
    let remaining = total;
    const update = () => {
      const pct = Math.max(
        0,
        Math.min(100, Math.round(((total - remaining) / total) * 100))
      );
      try {
        chrome.notifications.create(id, {
          type: "progress",
          iconUrl: "/icon128.png",
          title: `${domain} — closing soon`,
          message: `${Math.ceil(remaining / 1000)}s remaining`,
          progress: pct,
          buttons: [{ title: "Snooze 5m" }, { title: "Extend 10m" }],
        });
      } catch (e) {}
    };
    // initial
    update();
    const iv = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        try {
          chrome.notifications.clear(id);
        } catch (e) {}
        clearInterval(_countdownTimers[id]);
        delete _countdownTimers[id];
      } else {
        try {
          chrome.notifications.update(id, {
            type: "progress",
            iconUrl: "/icon128.png",
            title: `${domain} — closing soon`,
            message: `${Math.ceil(remaining / 1000)}s remaining`,
            progress: Math.max(
              0,
              Math.min(100, Math.round(((total - remaining) / total) * 100))
            ),
          });
        } catch (e) {}
      }
    }, 1000);
    _countdownTimers[id] = iv;
    // stop after total ms
    setTimeout(() => {
      try {
        chrome.notifications.clear(id);
      } catch (e) {}
      clearInterval(_countdownTimers[id]);
      delete _countdownTimers[id];
    }, total + 2000);
  } catch (e) {}
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

async function incrementDomainUsage(domain, seconds = 60, tabId = null) {
  if (!domain) return;
  const data = await getStorage([
    "usage",
    "limits",
    "blocked",
    "snoozes",
    "whitelist",
  ]);
  const usage = data.usage || {};
  const limits = data.limits || {};
  const blocked = data.blocked || {};
  const snoozes = data.snoozes || {};
  const whitelist = data.whitelist || [];

  const now = Date.now();
  // skip counting for whitelisted domains
  if (whitelist && whitelist.includes(domain)) return;
  // skip counting while snoozed
  if (snoozes[domain] && snoozes[domain] > now) return;
  // skip counting for actively blocked domains
  const bEntry = blocked[domain];
  const blockedUntil = bEntry && bEntry.until ? bEntry.until : null;
  if (bEntry === true || (blockedUntil && blockedUntil > now)) return;

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
    // If already blocked, do nothing
    if (blocked[domain]) return;
    // If a grace entry already exists for this domain on any tab, do not reset it for the same tab
    const g = (await getStorage(["grace"])) || {};
    const graceMap = g.grace || {};
    const now = Date.now();
    // If there is already a grace entry for this specific tab, skip
    if (tabId && graceMap[String(tabId)] && graceMap[String(tabId)].until > now)
      return;

    // Start a 1-minute grace period for this tab before enforcing a block
    const graceUntil = Date.now() + 60 * 1000;
    if (tabId) {
      graceMap[String(tabId)] = { domain, until: graceUntil };
    } else {
      // fallback: assign a pseudo key by domain to preserve legacy behavior
      graceMap[`domain_${domain}`] = { domain, until: graceUntil };
    }
    await setStorage({ usage, grace: graceMap });

    // send one notification only for the grace period for this tab
    try {
      const key = `grace_notified_${domain}_${tabId || "legacy"}`;
      const prev = await getStorage([key]);
      if (!prev[key]) {
        // show an animated countdown/progress notification for the grace period
        try {
          showCountdownNotification(domain, 60 * 1000);
        } catch (e) {}
        const obj = {};
        obj[key] = true;
        await setStorage(obj);
      }
    } catch (e) {}

    return;
  }
  await setStorage({ usage });

  // --- predictive suggestions & rapid-switch detection ---
  try {
    const mod = await import("../utils/categories.js");
    const { predictDistraction, classifyUrlWithConfidence } = mod;
    const recentActions = {};
    try {
      const meta = await getStorage([`tab_switches_${domain}`, `usageHistory`]);
      recentActions.visitsLastHour = meta[`tab_switches_${domain}`] || 0;
      // compute total minutes today for domain
      const usageHistory =
        (meta.usageHistory && meta.usageHistory[domain]) || [];
      recentActions.totalTimeTodayMinutes = Math.round(
        usageHistory.reduce((s, e) => s + (e.s || 0), 0) / 60
      );
      // simple rapid tab switches metric
      recentActions.rapidTabSwitches = recentActions.visitsLastHour;
    } catch (e) {}

    const p = predictDistraction(domain, recentActions);
    // if high probability of distraction but not yet blocked, suggest blocking
    if (p >= 0.7) {
      const key = `predicted_${domain}`;
      const prev = await getStorage([key]);
      if (!prev[key]) {
        chrome.notifications.create(`sitefuse_predict_${domain}`, {
          type: "basic",
          iconUrl: "/icon128.png",
          title: "Potential distraction detected",
          message: `${domain} looks like it might become a distraction. Block for a focused session?`,
          buttons: [{ title: "Block 30m" }, { title: "Remind later" }],
        });
        const o = {};
        o[key] = true;
        await setStorage(o);
      }
    }
  } catch (e) {}

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
  // grace check alarm: runs every 5 seconds to enforce grace expirations
  chrome.alarms.clear("sitefuse_grace", () => {
    const gMinutes = 5 / 60; // 5 seconds
    try {
      chrome.alarms.create("sitefuse_grace", { periodInMinutes: gMinutes });
    } catch (e) {
      // fall back to 1 minute if creation fails
      chrome.alarms.create("sitefuse_grace", { periodInMinutes: 1 });
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
      // run auto adjustments to limits based on trends
      try {
        await autoAdjustLimits();
      } catch (e) {}
    } catch (e) {}

    // Daily maintenance: record today's results and reset usage
    try {
      const mod = await import("../utils/storage.js");
      const { recordDailyResult } = mod;
      const data = await getStorage(["limits", "usage"]);
      const limits = data.limits || {};
      const usage = data.usage || {};
      const dateStr = new Date().toISOString().slice(0, 10);
      for (const d of Object.keys(limits)) {
        const under = (usage[d] || 0) <= (limits[d] || 0) * 60;
        try {
          await recordDailyResult(dateStr, d, under);
        } catch (e) {}
      }
      // reset today's usage while preserving history
      await setStorage({ usage: {} });

      // clear per-domain progress notifications and threshold flags
      try {
        const all = await getStorage(null);
        const keysToRemove = [];
        for (const k of Object.keys(all || {})) {
          if (k && k.startsWith("notif_")) keysToRemove.push(k);
        }
        // remove keys if any
        if (keysToRemove.length) {
          chrome.storage.local.remove(keysToRemove, () => {});
        }
        // clear progress notifications for known domains
        const domains = Object.keys(limits || {});
        for (const dom of domains) {
          try {
            chrome.notifications.clear(`sitefuse_progress_${dom}`);
          } catch (e) {}
        }
      } catch (e) {}
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
      // increment per-tab so we can attribute grace to individual tabIds
      for (const t of tabs) {
        try {
          if (!t.url) continue;
          const dom = domainFromUrl(t.url);
          if (!dom) continue;
          await incrementDomainUsage(dom, seconds, t.id);
        } catch (e) {}
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

// Grace expiration handler: close tabs and finalize blocks when grace ends
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || alarm.name !== "sitefuse_grace") return;
  try {
    const s = await getStorage(["grace", "blocked", "whitelist"]);
    const grace = s.grace || {};
    const blocked = s.blocked || {};
    const whitelist = s.whitelist || [];
    const now = Date.now();
    let didChange = false;
    for (const key of Object.keys(grace)) {
      try {
        const entry = grace[key];
        if (!entry || !entry.until) continue;
        const until = entry.until;
        const domain = entry.domain;
        if (now >= until) {
          // if domain is whitelisted, skip enforcement for this tab
          if (whitelist && whitelist.includes(domain)) {
            // remove grace entry but do not close or block
            delete grace[key];
            didChange = true;
            // clear notification if present
            try {
              chrome.notifications.clear(`sitefuse_grace_${domain}_${key}`);
            } catch (e) {}
            // clear grace_notified flag
            try {
              const gkey = `grace_notified_${domain}_${key}`;
              chrome.storage.local.remove([gkey]);
            } catch (e) {}
            continue;
          }

          // attempt to close the specific tab key (tabId)
          try {
            const tabIdNum = Number(key.replace(/^domain_/, "")) || Number(key);
            if (!Number.isNaN(tabIdNum)) {
              try {
                chrome.tabs.remove(tabIdNum);
              } catch (e) {}
            }
          } catch (e) {}

          // set persistent block for the domain so future visits are redirected
          blocked[domain] = true;

          // clear grace metadata and notifications
          try {
            chrome.notifications.clear(`sitefuse_grace_${domain}_${key}`);
          } catch (e) {}
          try {
            const gkey = `grace_notified_${domain}_${key}`;
            chrome.storage.local.remove([gkey]);
          } catch (e) {}

          delete grace[key];
          didChange = true;
        }
      } catch (e) {}
    }
    if (didChange) await setStorage({ grace, blocked });
  } catch (e) {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "block-now") {
    (async () => {
      const domain = msg.domain;
      const data = await getStorage(["blocked", "whitelist"]);
      const blocked = data.blocked || {};
      const whitelist = data.whitelist || [];
      // if domain is whitelisted, remove it from whitelist before blocking
      const wl = whitelist.filter((d) => d !== domain);
      blocked[domain] = true;
      await setStorage({ blocked, whitelist: wl });
      chrome.tabs.query({}, (tabs) => {
        const blockedUrl = chrome.runtime.getURL("blocked.html");
        for (const t of tabs) {
          try {
            const d = domainFromUrl(t.url);
            if (d === domain) {
              try {
                chrome.tabs.update(t.id, {
                  url: `${blockedUrl}?fromTab=${
                    t.id
                  }&domain=${encodeURIComponent(d)}`,
                });
              } catch (e) {
                try {
                  chrome.tabs.sendMessage(
                    t.id,
                    { action: "redirect" },
                    () => {}
                  );
                } catch (e) {}
              }
            }
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

// Merge usage reported by popup to avoid overwrite races.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === "merge-usage") {
    (async () => {
      try {
        const domain = msg.domain;
        const reported = Number(msg.seconds) || 0;
        const data = await getStorage(["usage"]);
        const usage = data.usage || {};
        const stored = usage[domain] || 0;
        // Keep the larger value to avoid losing seconds or double-counting
        const merged = Math.max(stored, reported);
        if (merged !== stored) {
          usage[domain] = merged;
          await setStorage({ usage });
        }
        sendResponse({ ok: true, merged });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
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
        const g = await getStorage(["blocked", "whitelist"]);
        const b = g.blocked || {};
        const whitelist = g.whitelist || [];
        // remove blocked domains from whitelist so focus can take effect
        for (const dom of toBlock) {
          // remove from whitelist if present
          const idx = whitelist.indexOf(dom);
          if (idx !== -1) whitelist.splice(idx, 1);
          b[dom] = { ...(b[dom] || {}), until };
        }
        await setStorage({ blocked: b, whitelist });
        // redirect tabs
        chrome.tabs.query({}, (tabs) => {
          const blockedUrl = chrome.runtime.getURL("blocked.html");
          for (const t of tabs) {
            try {
              const d = domainFromUrl(t.url);
              if (d && b[d] && !(whitelist && whitelist.includes(d))) {
                try {
                  chrome.tabs.update(t.id, {
                    url: `${blockedUrl}?fromTab=${
                      t.id
                    }&domain=${encodeURIComponent(d)}`,
                  });
                } catch (e) {
                  try {
                    chrome.tabs.sendMessage(
                      t.id,
                      { action: "redirect" },
                      () => {}
                    );
                  } catch (e) {}
                }
              }
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

// Support queries from content/extension pages about per-tab grace
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === "is-tab-in-grace") {
    const tabId = sender && sender.tab && sender.tab.id;
    if (!tabId) return sendResponse({ until: null });
    try {
      const s = await getStorage(["grace"]);
      const grace = s.grace || {};
      const entry = grace[String(tabId)];
      if (entry && entry.until)
        return sendResponse({ until: entry.until, domain: entry.domain });
      return sendResponse({ until: null });
    } catch (e) {
      return sendResponse({ until: null });
    }
  }
  if (msg.action === "get-grace-for-tab") {
    const tabId = msg.tabId || (sender && sender.tab && sender.tab.id);
    if (!tabId) return sendResponse({ entry: null });
    try {
      const s = await getStorage(["grace"]);
      const grace = s.grace || {};
      return sendResponse({ entry: grace[String(tabId)] || null });
    } catch (e) {
      return sendResponse({ entry: null });
    }
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
