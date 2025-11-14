const CATEGORY_RULES = [
  {
    name: "social",
    pattern:
      /(^|\.)facebook\.com$|(^|\.)twitter\.com$|(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)reddit\.com$|(^|\.)linkedin\.com$|(^|\.)pinterest\.com$|(^|\.)snapchat\.com$|(^|\.)discord\.com$/i,
    default: 30,
  },
  {
    name: "video",
    pattern:
      /(^|\.)youtube\.com$|(^|\.)netflix\.com$|(^|\.)twitch\.tv$|(^|\.)hulu\.com$|(^|\.)vimeo\.com$|(^|\.)dailymotion\.com$/i,
    default: 40,
  },
  {
    name: "gaming",
    pattern:
      /(^|\.)steamcommunity\.com$|(^|\.)roblox\.com$|(^|\.)epicgames\.com$|(^|\.)origin\.com$|(^|\.)riotgames\.com$/i,
    default: 25,
  },
  {
    name: "work",
    pattern:
      /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)bitbucket\.org$|(^|\.)stackoverflow\.com$|(^|\.)asana\.com$|(^|\.)slack\.com$|(^|\.)chatgpt\.com$|(^|\.)deepseek\.ai$|(^|\.)openai\.com$/i,
    default: 0,
  },
  {
    name: "news",
    pattern:
      /(^|\.)nytimes\.com$|(^|\.)cnn\.com$|(^|\.)bbc\.co$|(^|\.)theguardian\.com$|(^|\.)reuters\.com$/i,
    default: 25,
  },
  {
    name: "shopping",
    pattern:
      /(^|\.)amazon\.com$|(^|\.)ebay\.com$|(^|\.)etsy\.com$|(^|\.)walmart\.com$|(^|\.)aliexpress\.com$/i,
    default: 20,
  },
  {
    name: "education",
    pattern:
      /(^|\.)khanacademy\.org$|(^|\.)coursera\.org$|(^|\.)edx\.org$|(^|\.)udemy\.com$|(^|\.)wikipedia\.org$/i,
    default: 30,
  },
  {
    name: "health",
    pattern:
      /(^|\.)webmd\.com$|(^|\.)mayoclinic\.org$|(^|\.)cdc\.gov$|(^|\.)nih\.gov$/i,
    default: 20,
  },
  {
    name: "finance",
    pattern:
      /(^|\.)chase\.com$|(^|\.)paypal\.com$|(^|\.)bankofamerica\.com$|(^|\.)coinbase\.com$|(^|\.)robinhood\.com$/i,
    default: 15,
  },
  {
    name: "other",
    pattern: /./,
    default: 15,
  },
];

export function categorizeDomain(domain) {
  if (!domain) return "other";
  for (const r of CATEGORY_RULES) {
    if (r.pattern.test(domain)) return r.name;
  }
  return "other";
}

export function defaultLimitForCategory(cat) {
  const r = CATEGORY_RULES.find((x) => x.name === cat);
  return r ? r.default : 15;
}

export function knownCategories() {
  return CATEGORY_RULES.map((r) => r.name);
}

// --- Advanced site intelligence helpers ---
// Provide a confidence-based classification using hostname, path, and heuristics.
export function classifyUrlWithConfidence(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname + (u.search || "");

    // base category from domain rules
    const base = categorizeDomain(host);

    // heuristics: search keywords in path or query
    const heuristics = {
      social: [/share|post|status|profile|followers|friends/i],
      video: [/watch|v=|stream|player|playlist|embed/i],
      shopping: [/cart|product|buy|checkout|order|browse/i],
      news: [/article|news|breaking|edition|politics|opinion/i],
      gaming: [/play|match|game|leaderboard|skins|gg|steam/i],
      work: [/repo|issue|pull|merge|task|ticket|doc|meet|calendar/i],
    };

    let score = 0.7; // base confidence
    let category = base;

    for (const [cat, patterns] of Object.entries(heuristics)) {
      for (const p of patterns) {
        if (p.test(path) || p.test(u.search)) {
          if (cat !== base) score = Math.max(score, 0.6);
          category = cat;
          score = Math.min(0.98, score + 0.12);
        }
      }
    }

    // boost confidence for exact domain matches in rules
    const exactRule = CATEGORY_RULES.find((r) => r.pattern.test(host));
    if (exactRule && exactRule.name === category)
      score = Math.min(0.995, score + 0.15);

    // small tweaks for certain TLDs or subdomains
    if (/news|blog|press/i.test(host)) {
      if (category !== "news") category = "news";
      score = Math.max(score, 0.7);
    }

    return { category, confidence: Math.round(score * 100) / 100 };
  } catch (e) {
    return { category: "other", confidence: 0.4 };
  }
}

// Suggest a smart daily limit (minutes) based on category, prior usage, and simple heuristics
export function suggestSmartLimit(category, historicalUsageMinutes = []) {
  // historicalUsageMinutes: recent daily usage array (numbers in minutes)
  const base = defaultLimitForCategory(category);
  if (!historicalUsageMinutes || historicalUsageMinutes.length === 0)
    return base;

  const avg =
    historicalUsageMinutes.reduce((a, b) => a + b, 0) /
    historicalUsageMinutes.length;

  // If user habitually exceeds base by >30%, raise slightly as soft suggestion, else lower
  if (avg > base * 1.3) return Math.max(10, Math.round(base * 0.9));
  if (avg < base * 0.7) return Math.max(5, Math.round(base * 0.8));

  // otherwise return base adjusted by trend
  const trend =
    historicalUsageMinutes[historicalUsageMinutes.length - 1] -
    historicalUsageMinutes[0];
  if (trend > 15) return Math.max(10, base - 5);
  if (trend < -15) return base + 10;
  return base;
}

// Predict whether a domain is likely to become a distraction soon based on short-term signals
export function predictDistraction(domain, recentActions = {}) {
  // recentActions: {visitsLastHour, totalTimeTodayMinutes, rapidTabSwitches}
  const visits = recentActions.visitsLastHour || 0;
  const timeToday = recentActions.totalTimeTodayMinutes || 0;
  const rapid = recentActions.rapidTabSwitches || 0;

  let score = 0.0;
  if (visits >= 3) score += 0.4;
  if (timeToday >= 15) score += 0.3;
  if (rapid >= 5) score += 0.25;

  // domain heuristics
  const cat = categorizeDomain(domain);
  if (["social", "video", "gaming", "shopping", "news"].includes(cat))
    score += 0.15;

  return Math.min(1, Math.round(score * 100) / 100);
}
