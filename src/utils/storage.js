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

// Predict potential distraction domains by comparing recent 7-day usage with the prior 7 days.
export async function getPredictedDistractions(
  thresholdRatio = 0.5,
  limit = 10
) {
  const all = await getStorage(["usageHistory", "usage"]);
  const usageHistory = all.usageHistory || {};
  const out = [];
  const now = Date.now();
  for (const domain of Object.keys(usageHistory)) {
    const arr = usageHistory[domain];
    let recent = 0;
    let prior = 0;
    for (const e of arr) {
      const daysAgo = Math.floor((now - e.t) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo < 7) recent += e.s;
      if (daysAgo >= 7 && daysAgo < 14) prior += e.s;
    }
    // If prior is small, require absolute recent > 30m
    const recentMins = recent / 60;
    const priorMins = prior / 60;
    const ratio = prior > 0 ? (recent - prior) / prior : recent > 0 ? 1 : 0;
    if (
      (prior > 0 && ratio >= thresholdRatio) ||
      (prior === 0 && recentMins >= 30)
    ) {
      out.push({ domain, recent: recentMins, prior: priorMins, score: ratio });
    }
  }
  out.sort((a, b) => b.recent - a.recent);
  return out
    .slice(0, limit)
    .map((o) => ({ domain: o.domain, minutes: Math.round(o.recent) }));
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

// Whitelist helpers: simple array of domains that are never blocked
export async function getWhitelist() {
  const r = await getStorage(["whitelist"]);
  return r.whitelist || [];
}

export async function addWhitelist(domain) {
  const r = await getStorage(["whitelist"]);
  const list = r.whitelist || [];
  if (!list.includes(domain)) list.push(domain);
  await setStorage({ whitelist: list });
}

export async function removeWhitelist(domain) {
  const r = await getStorage(["whitelist"]);
  const list = r.whitelist || [];
  const out = list.filter((d) => d !== domain);
  await setStorage({ whitelist: out });
}

// Custom categories management. `categoriesList` stores objects { name, color? }
export async function getCategoriesList() {
  const r = await getStorage(["categoriesList"]);
  return r.categoriesList || [];
}

export async function addCategory(name, meta = {}) {
  const r = await getStorage(["categoriesList"]);
  const list = r.categoriesList || [];
  if (!list.find((c) => c.name === name)) list.push({ name, ...meta });
  await setStorage({ categoriesList: list });
}

export async function removeCategory(name) {
  const r = await getStorage(["categoriesList", "categories"]);
  const list = r.categoriesList || [];
  const mapping = r.categories || {};
  const out = list.filter((c) => c.name !== name);
  // reassign domains in that category to 'other'
  for (const d of Object.keys(mapping)) {
    if (mapping[d] === name) mapping[d] = "other";
  }
  await setStorage({ categoriesList: out, categories: mapping });
}

export async function assignDomainToCategory(domain, category) {
  const r = await getStorage(["categories"]);
  const mapping = r.categories || {};
  mapping[domain] = category;
  await setStorage({ categories: mapping });
}

export async function getDomainsForCategory(category) {
  const r = await getStorage(["categories", "usage"]);
  const mapping = r.categories || {};
  const usage = r.usage || {};
  const out = [];
  for (const d of Object.keys(mapping)) {
    if (mapping[d] === category) out.push({ domain: d, usage: usage[d] || 0 });
  }
  return out;
}

// Grace period helpers: support per-tab grace entries keyed by tabId.
// Each grace entry is stored as: grace: { [tabId]: { domain, until } }
export async function setGraceForTab(tabId, domain, timestamp) {
  const r = await getStorage(["grace"]);
  const grace = r.grace || {};
  grace[String(tabId)] = { domain, until: timestamp };
  await setStorage({ grace });
}

export async function getGraceForTab(tabId) {
  const r = await getStorage(["grace"]);
  const grace = r.grace || {};
  const entry = grace[String(tabId)];
  return entry || null;
}

export async function removeGraceForTab(tabId) {
  const r = await getStorage(["grace"]);
  const grace = r.grace || {};
  delete grace[String(tabId)];
  await setStorage({ grace });
}

export async function getAllGraceTabs() {
  const r = await getStorage(["grace"]);
  return r.grace || {};
}

// Backwards-compatible domain helpers (map previous callers if needed)
export async function setGraceUntil(domain, timestamp) {
  // store legacy domain-keyed entry under a special key to avoid collision
  const r = await getStorage(["grace", "_legacy_grace"]);
  const legacy = r._legacy_grace || {};
  legacy[domain] = timestamp;
  await setStorage({ _legacy_grace: legacy });
}

export async function getGraceUntil(domain) {
  const r = await getStorage(["_legacy_grace"]);
  const legacy = r._legacy_grace || {};
  return legacy[domain] || null;
}

export async function removeGrace(domain) {
  const r = await getStorage(["_legacy_grace"]);
  const legacy = r._legacy_grace || {};
  delete legacy[domain];
  await setStorage({ _legacy_grace: legacy });
}

export async function getAllGrace() {
  const r = await getStorage(["_legacy_grace"]);
  return r._legacy_grace || {};
}
