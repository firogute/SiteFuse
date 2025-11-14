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
