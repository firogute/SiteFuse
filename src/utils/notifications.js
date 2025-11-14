export function notify(title, message, id = null) {
  if (!chrome.notifications) return
  const nid = id || `sitefuse_${Date.now()}`
  chrome.notifications.create(nid, {
    type: 'basic',
    title,
    message,
    iconUrl: '/icons/icon128.png'
  }, () => {})
  return nid
}

export function clearNotification(id) {
  if (!chrome.notifications) return
  chrome.notifications.clear(id, () => {})
}
