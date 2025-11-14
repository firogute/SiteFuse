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
