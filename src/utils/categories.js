// Simple domain categorization rules and default daily limits (minutes)
const CATEGORY_RULES = [
  { name: 'social', pattern: /(^|\.)facebook\.com$|(^|\.)twitter\.com$|(^|\.)instagram\.com$|(^|\.)tiktok\.com$|(^|\.)reddit\.com$/i, default: 30 },
  { name: 'video', pattern: /(^|\.)youtube\.com$|(^|\.)netflix\.com$|(^|\.)twitch\.tv$/i, default: 40 },
  { name: 'gaming', pattern: /(^|\.)steamcommunity\.com$|(^|\.)roblox\.com$|(^|\.)epicgames\.com$/i, default: 20 },
  { name: 'work', pattern: /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)stackoverflow\.com$/i, default: 0 },
  { name: 'news', pattern: /(^|\.)nytimes\.com$|(^|\.)cnn\.com$|(^|\.)bbc\.co/ i, default: 20 }
]

export function categorizeDomain(domain) {
  if (!domain) return 'other'
  for (const r of CATEGORY_RULES) {
    if (r.pattern.test(domain)) return r.name
  }
  return 'other'
}

export function defaultLimitForCategory(cat) {
  const r = CATEGORY_RULES.find((x) => x.name === cat)
  return r ? r.default : 15
}

export function knownCategories() {
  return CATEGORY_RULES.map((r) => r.name).concat(['other'])
}
