export function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (res) => resolve(res));
  });
}

export function setStorage(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

export async function getAll() {
  return await getStorage(null);
}

// Higher-level helpers for domains, limits, blocking and history
export async function getUsage(domain) {
  const r = await getStorage(["usage"]);
  const usage = r.usage || {};
  return usage[domain] || 0;
}

export async function setLimit(domain, minutes) {
  const r = await getStorage(["limits"]);
  const limits = r.limits || {};
  limits[domain] = minutes;
  await setStorage({ limits });
}

export async function removeLimit(domain) {
  const r = await getStorage(["limits"]);
  const limits = r.limits || {};
  delete limits[domain];
  await setStorage({ limits });
}

export async function blockDomain(domain, meta = {}) {
  const r = await getStorage(["blocked"]);
  const blocked = r.blocked || {};
  blocked[domain] = {
    ...(blocked[domain] || {}),
    ...meta,
    blockedAt: Date.now(),
  };
  await setStorage({ blocked });
}

export async function unblockDomain(domain) {
  const r = await getStorage(["blocked"]);
  const blocked = r.blocked || {};
  delete blocked[domain];
  await setStorage({ blocked });
}

// Usage history: store timestamped entries to enable trends (last 7 days)
export async function addUsageEntry(domain, seconds = 60) {
  const r = await getStorage(["usageHistory", "usage"]);
  const usageHistory = r.usageHistory || {};
  const usage = r.usage || {};
  const now = Date.now();
  if (!usageHistory[domain]) usageHistory[domain] = [];
  usageHistory[domain].push({ t: now, s: seconds });
  // Trim history to last 30 days roughly
  const cutoff = now - 1000 * 60 * 60 * 24 * 30;
  usageHistory[domain] = usageHistory[domain].filter((e) => e.t >= cutoff);

  usage[domain] = (usage[domain] || 0) + seconds;
  await setStorage({ usageHistory, usage });
}

export async function getUsageLast7Days(domain) {
  const r = await getStorage(["usageHistory"]);
  const usageHistory = (r.usageHistory && r.usageHistory[domain]) || [];
  const days = Array.from({ length: 7 }).map(() => 0);
  const now = Date.now();
  for (const e of usageHistory) {
    const daysAgo = Math.floor((now - e.t) / (1000 * 60 * 60 * 24));
    if (daysAgo >= 0 && daysAgo < 7) {
      days[6 - daysAgo] += e.s;
    }
  }
  return days; // seconds per day, ordered oldest->newest
}

// Suggest defaults and keep track of categories, streaks, and CSV export
export async function ensureDomainCategory(domain, category, suggestedLimit) {
  const r = await getStorage(["categories", "limits"]);
  const categories = r.categories || {};
  const limits = r.limits || {};
  if (!categories[domain]) categories[domain] = category || "other";
  if (!limits[domain] && suggestedLimit) limits[domain] = suggestedLimit;
  await setStorage({ categories, limits });
}

export async function recordDailyResult(dateStr, domain, underLimit) {
  const r = await getStorage(["streaks", "dailyResults", "limits"]);
  const streaks = r.streaks || { current: 0, best: 0 };
  const daily = r.dailyResults || {};
  const limits = r.limits || {};
  if (!daily[dateStr]) daily[dateStr] = {};
  daily[dateStr][domain] = !!underLimit;
  // simple streak calc: if all tracked domains under limit, increment
  const allDomains = Object.keys(limits || {});
  const todayResults =
    allDomains.length > 0 && allDomains.every((d) => daily[dateStr][d]);
  if (todayResults) {
    streaks.current = (streaks.current || 0) + 1;
    streaks.best = Math.max(streaks.best || 0, streaks.current);
  } else {
    streaks.current = 0;
  }
  await setStorage({ streaks, dailyResults: daily });
}

export async function exportAllToCSV() {
  const all = await getStorage(null);
  // Build CSV: domain, total_seconds, limit_mins, category
  const domains = new Set([
    ...Object.keys(all.usage || {}),
    ...Object.keys(all.limits || {}),
    ...Object.keys(all.categories || {}),
  ]);
  const rows = [["domain", "total_seconds", "limit_mins", "category"]];
  for (const d of domains) {
    rows.push([
      d,
      (all.usage && all.usage[d]) || 0,
      (all.limits && all.limits[d]) || "",
      (all.categories && all.categories[d]) || "",
    ]);
  }
  return rows
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

// Schedules: entries describe blocking windows per domain or category
// schedule = { id, type: 'domain'|'category', target, days: [0..6], start: '21:00', end: '07:00', enabled: true }
export async function getSchedules() {
  const r = await getStorage(["schedules"]);
  return r.schedules || [];
}

export async function addSchedule(entry) {
  const r = await getStorage(["schedules"]);
  const schedules = r.schedules || [];
  entry.id = entry.id || `sch_${Date.now()}`;
  schedules.push(entry);
  await setStorage({ schedules });
  return entry;
}

export async function removeSchedule(id) {
  const r = await getStorage(["schedules"]);
  const schedules = r.schedules || [];
  const out = schedules.filter((s) => s.id !== id);
  await setStorage({ schedules: out });
}

export async function getUsageLast30Days(domain) {
  const r = await getStorage(["usageHistory"]);
  const usageHistory = (r.usageHistory && r.usageHistory[domain]) || [];
  const days = Array.from({ length: 30 }).map(() => 0);
  const now = Date.now();
  for (const e of usageHistory) {
    const daysAgo = Math.floor((now - e.t) / (1000 * 60 * 60 * 24));
    if (daysAgo >= 0 && daysAgo < 30) {
      days[29 - daysAgo] += e.s;
    }
  }
  return days;
}

export async function getAggregatedUsageByCategory() {
  const all = await getStorage(["usage", "categories"]);
  const usage = all.usage || {};
  const categories = all.categories || {};
  const agg = {};
  for (const d of Object.keys(usage)) {
    const cat = categories[d] || "other";
    agg[cat] = (agg[cat] || 0) + usage[d];
  }
  return agg;
}

export async function getTopDomains(limit = 10) {
  const all = await getStorage(["usage"]);
  const usage = all.usage || {};
  return Object.keys(usage)
    .sort((a, b) => (usage[b] || 0) - (usage[a] || 0))
    .slice(0, limit)
    .map((d) => ({ domain: d, seconds: usage[d] || 0 }));
}

// Gamification helpers: badges and streak calendar
export async function getStreaks() {
  const r = await getStorage(["streaks"]);
  return r.streaks || { current: 0, best: 0 };
}

export async function getBadges() {
  const r = await getStorage(["badges"]);
  return r.badges || {};
}

export async function awardBadge(id, meta = {}) {
  const r = await getStorage(["badges"]);
  const badges = r.badges || {};
  badges[id] = { ...(badges[id] || {}), ...meta, awardedAt: Date.now() };
  await setStorage({ badges });
}

export async function getStreakCalendar(days = 30) {
  const r = await getStorage(["dailyResults"]);
  const daily = r.dailyResults || {};
  const now = Date.now();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({
      date: key,
      success: !!daily[key] && Object.values(daily[key]).every(Boolean),
    });
  }
  return out;
}
