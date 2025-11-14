export function getFaviconForDomain(domain) {
  if (!domain) return '/icons/icon48.png'
  // Use DuckDuckGo or Google favicon service as a fallback
  try {
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`
  } catch (e) {
    return '/icons/icon48.png'
  }
}
