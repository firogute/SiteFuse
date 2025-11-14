import React, { useEffect, useState, useRef } from 'react'
import { getStorage, setStorage, getUsage, getUsageLast7Days, blockDomain, unblockDomain, setLimit as storageSetLimit, getAll, ensureDomainCategory, exportAllToCSV, getAggregatedUsageByCategory, getTopDomains, getStreaks, getPredictedDistractions } from '../utils/storage'
import Badges from './Badges'
import StreakCalendar from './StreakCalendar'
import { categorizeDomain, defaultLimitForCategory } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { Cog6ToothIcon, ShieldExclamationIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { getFaviconForDomain } from '../utils/favicons'
import UsageChart from './UsageChart'

function formatSeconds(s) {
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
}

function ProgressBar({ value = 0 }) {
    const pct = Math.min(100, Math.max(0, value))
    return (
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
                className={`h-3 transition-all duration-300 ${pct >= 90 ? 'bg-red-500' :
                    pct >= 75 ? 'bg-orange-400' :
                        'bg-indigo-500'
                    }`}
                style={{ width: `${pct}%` }}
            />
        </div>
    )
}

export default function Popup() {
    const [domain, setDomain] = useState(null)
    const [usage, setUsage] = useState(0)
    const usageRef = useRef(0)
    const [limit, setLimit] = useState(null)
    const [blocked, setBlocked] = useState(false)
    const [fav, setFav] = useState(null)
    const [theme, setTheme] = useState('auto')
    const sysPref = useRef(null)
    const [trend, setTrend] = useState([0, 0, 0, 0, 0, 0, 0])
    const [graceUntil, setGraceUntilState] = useState(null)
    const [tabId, setTabId] = useState(null)
    const [categoryAgg, setCategoryAgg] = useState({})
    const [topDomains, setTopDomains] = useState([])
    const [dragIndex, setDragIndex] = useState(null)
    const [streaks, setStreaks] = useState({ current: 0, best: 0 })
    const [isActive, setIsActive] = useState(false)
    const [predictedDomains, setPredictedDomains] = useState([])

    // keep a ref of latest usage so async flushes can read the current value
    useEffect(() => { usageRef.current = usage }, [usage])

    useEffect(() => {
        (async () => {
            const tabs = await new Promise((r) => chrome.tabs.query({ active: true, lastFocusedWindow: true }, r))
            const tab = tabs[0]
            const d = tab && tab.url ? new URL(tab.url).hostname : null
            setTabId(tab && tab.id ? tab.id : null)
            setDomain(d)
            const data = await getStorage(['usage', 'limits', 'blocked'])
            setUsage((data.usage && data.usage[d]) || 0)
            setLimit((data.limits && data.limits[d]) || null)
            const b = data.blocked && data.blocked[d]
            setBlocked(!!b)
            if (d) {
                setFav(getFaviconForDomain(d))
                const t = await getUsageLast7Days(d)
                setTrend(t.map(x => Math.round(x / 60)))
                // ensure category and suggested default limit
                const cat = categorizeDomain(d)
                const suggested = defaultLimitForCategory(cat)
                await ensureDomainCategory(d, cat, suggested)
                // check grace period for this tab
                try {
                    const g = await getStorage(['grace'])
                    const gu = (g.grace && tab && g.grace[String(tab.id)]) ? g.grace[String(tab.id)].until : null
                    setGraceUntilState(gu)
                } catch (e) { }
            }
            const all = await getAll()
            const th = (all.theme || 'auto')
            setTheme(th)
            // handle auto theme using matchMedia
            sysPref.current = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
            const applyTheme = (val) => {
                if (val === 'auto') {
                    const isDark = sysPref.current ? sysPref.current.matches : false
                    document.documentElement.classList.toggle('dark', isDark)
                } else {
                    document.documentElement.classList.toggle('dark', val === 'dark')
                }
            }
            applyTheme(th)
            if (sysPref.current) {
                sysPref.current.addEventListener && sysPref.current.addEventListener('change', () => {
                    if ((all.theme || 'auto') === 'auto') applyTheme('auto')
                })
            }
            try {
                const agg = await getAggregatedUsageByCategory()
                setCategoryAgg(agg)
                const top = await getTopDomains(5)
                setTopDomains(top)
                const s = await getStreaks()
                setStreaks(s)
                try {
                    const preds = await getPredictedDistractions()
                    setPredictedDomains(preds.slice(0, 4))
                } catch (e) { }
            } catch (e) { }
        })()
    }, [])

    // Drag-and-drop handlers for top domains reordering (simple client-side only)
    function onDragStart(e, idx) {
        setDragIndex(idx)
        try { e.dataTransfer.setData('text/plain', String(idx)) } catch (e) { }
    }
    function onDragOver(e) { e.preventDefault() }
    function onDrop(e, idx) {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/plain'))
        if (Number.isNaN(from)) return
        const copy = [...topDomains]
        const [moved] = copy.splice(from, 1)
        copy.splice(idx, 0, moved)
        setTopDomains(copy)
        setDragIndex(null)
        // persist priority ordering in storage as simple array
        try { setStorage({ topOrder: copy.map(x => x.domain) }) } catch (e) { }
    }

    async function applyLimit(mins) {
        if (!domain) return
        const minsN = parseInt(mins, 10)
        if (isNaN(minsN) || minsN <= 0) return
        await storageSetLimit(domain, minsN)
        setLimit(minsN)
    }

    function blockNow() {
        chrome.runtime.sendMessage({ action: 'block-now', domain }, () => {
            setBlocked(true)
        })
    }

    function unblock() {
        chrome.runtime.sendMessage({ action: 'unblock', domain }, () => {
            setBlocked(false)
        })
    }

    async function toggleTheme() {
        // cycle: auto -> dark -> light -> auto
        const next = theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto'
        setTheme(next)
        try {
            await setStorage({ theme: next })
        } catch (e) { }
        if (next === 'auto') {
            const isDark = sysPref.current ? sysPref.current.matches : false
            document.documentElement.classList.toggle('dark', isDark)
        } else {
            document.documentElement.classList.toggle('dark', next === 'dark')
        }
        try {
            // notify other extension pages to update immediately
            chrome.runtime.sendMessage({ action: 'theme-changed', theme: next })
        } catch (e) { }
    }

    function percentUsed() {
        if (!limit) return 0
        return Math.round((usage / (limit * 60)) * 100)
    }

    function formatCountdownMs(ms) {
        if (!ms || ms <= 0) return '0m 0s'
        const s = Math.ceil(ms / 1000)
        const mm = Math.floor(s / 60)
        const ss = s % 60
        return `${mm}m ${ss}s`
    }

    async function exportCSV() {
        const csv = await exportAllToCSV()
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        const a = document.createElement('a')
        a.href = url
        a.download = 'sitefuse_usage.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    function snooze(minutes = 5) {
        chrome.runtime.sendMessage({ action: 'snooze', domain, minutes }, (res) => {
            // optimistic UI update
        })
    }

    // Live update: optimistic per-second increment while popup is open AND the site is the currently active tab
    useEffect(() => {
        if (!domain) return
        let timer = null
        // helper to start/stop timer
        const startTimer = () => {
            if (timer) return
            // Track unsynced optimistic seconds and flush periodically
            let unsynced = 0
            timer = setInterval(async () => {
                setUsage((u) => (u || 0) + 1)
                unsynced += 1
                // flush every 2 seconds to persist optimistic increments (more aggressive)
                if (unsynced >= 2) {
                    unsynced = 0
                    try {
                        const localVal = usageRef.current || 0
                        try {
                            await new Promise((res) => chrome.runtime.sendMessage({ action: 'merge-usage', domain, seconds: localVal }, res))
                        } catch (e) { }
                    } catch (e) {
                        // ignore storage errors
                    }
                }
            }, 1000)
        }
        const stopTimer = () => {
            if (timer) {
                clearInterval(timer)
                timer = null
            }
        }

        // storage change handler: sync usage/grace
        const onStorage = (changes, area) => {
            if (area !== 'local') return
            if (changes.usage) {
                const u = (changes.usage.newValue && changes.usage.newValue[domain]) || 0
                setUsage(u)
            }
            if (changes.grace) {
                try {
                    const gmap = changes.grace.newValue || {}
                    const guEntry = tabId ? gmap[String(tabId)] : null
                    const gu = guEntry && guEntry.until ? guEntry.until : null
                    setGraceUntilState(gu)
                } catch (e) { }
            }
        }

        // determine whether the popup's domain matches the current active tab
        const updateActiveFromTabs = async () => {
            try {
                const tabs = await new Promise((r) => chrome.tabs.query({ active: true, lastFocusedWindow: true }, r))
                const tab = tabs && tabs[0]
                const cur = tab && tab.url ? new URL(tab.url).hostname : null
                const active = cur === domain
                setIsActive(active)
                if (active) startTimer()
                else stopTimer()
            } catch (e) {
                // ignore
            }
        }

        // tab event handlers to keep isActive accurate while popup is open
        const onActivated = () => updateActiveFromTabs()
        const onUpdated = (tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' || changeInfo.url) updateActiveFromTabs()
        }

        try { chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener(onStorage) } catch (e) { }
        try { chrome.tabs && chrome.tabs.onActivated && chrome.tabs.onActivated.addListener(onActivated) } catch (e) { }
        try { chrome.tabs && chrome.tabs.onUpdated && chrome.tabs.onUpdated.addListener(onUpdated) } catch (e) { }

        // initial sync from storage (usage, grace) and from tabs (active)
        ; (async () => {
            try {
                const g = await getStorage(['usage', 'grace'])
                const u = (g.usage && g.usage[domain]) || 0
                setUsage(u)
                const gu = (g.grace && tab && g.grace[String(tab.id)]) ? g.grace[String(tab.id)].until : null
                setGraceUntilState(gu)
            } catch (e) { }
            updateActiveFromTabs()
        })()

        // flush helper invoked on unload/cleanup
        const flushToStorage = async () => {
            try {
                const localVal = usageRef.current || 0
                // send merge request to background to safely merge usage values
                try {
                    await new Promise((res) => chrome.runtime.sendMessage({ action: 'merge-usage', domain, seconds: localVal }, res))
                } catch (e) { }
            } catch (e) { }
        }

        // try to flush when the popup window is closed or becomes hidden
        const onBeforeUnload = () => { try { flushToStorage() } catch (e) { } }
        const onVisibilityChange = () => {
            try {
                if (document && document.visibilityState === 'hidden') flushToStorage()
            } catch (e) { }
        }
        try { window && window.addEventListener && window.addEventListener('beforeunload', onBeforeUnload) } catch (e) { }
        try { document && document.addEventListener && document.addEventListener('visibilitychange', onVisibilityChange) } catch (e) { }

        return () => {
            try { chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.removeListener(onStorage) } catch (e) { }
            try { chrome.tabs && chrome.tabs.onActivated && chrome.tabs.onActivated.removeListener(onActivated) } catch (e) { }
            try { chrome.tabs && chrome.tabs.onUpdated && chrome.tabs.onUpdated.removeListener(onUpdated) } catch (e) { }
            try { window && window.removeEventListener && window.removeEventListener('beforeunload', onBeforeUnload) } catch (e) { }
            try { document && document.removeEventListener && document.removeEventListener('visibilitychange', onVisibilityChange) } catch (e) { }
            // flush optimistic increments one last time
            try { flushToStorage() } catch (e) { }
            stopTimer()
        }
    }, [domain])

    // tick to refresh grace countdown while popup is open
    useEffect(() => {
        let t = null
        if (graceUntil) {
            t = setInterval(async () => {
                // refresh from storage in case of changes from background
                try {
                    const g = await getStorage(['grace'])
                    const GU = (g.grace && tabId && g.grace[String(tabId)]) ? g.grace[String(tabId)].until : null
                    setGraceUntilState(GU)
                } catch (e) { }
            }, 1000)
        }
        return () => clearInterval(t)
    }, [graceUntil, domain, tabId])

    async function startFocus(minutes = 25) {
        try {
            // default to blocking social/video/game categories during focus
            const categories = ['social', 'video', 'gaming']
            const res = await new Promise((r) => chrome.runtime.sendMessage({ action: 'start-focus', minutes, categories }, r))
            if (res && res.ok) {
                // optimistic UI: maybe show a small toast in the popup (omitted)
            }
        } catch (e) { }
    }

    return (
        <div className="min-w-[350px] max-w-[350px] font-sans bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                            src={fav || '/icon128.png'}
                            alt={`${domain || 'site'} favicon`}
                            className="w-8 h-8 rounded-lg flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Current Site</div>
                            <div className="text-lg font-bold truncate">{domain || 'No active site'}</div>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center flex-shrink-0">
                        <motion.button
                            aria-label="Theme toggle"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            onClick={toggleTheme}
                        >
                            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <Cog6ToothIcon className="w-4 h-4" />}
                        </motion.button>
                        <a
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors btn-no-outline"
                            href="/options.html"
                        >
                            Settings
                        </a>
                    </div>
                </div>

                {/* Grace Period Alert */}
                {graceUntil && graceUntil > Date.now() ? (
                    <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Grace Period Active</div>
                        </div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                            This site will close in <strong aria-live="polite" className="font-mono">{formatCountdownMs(graceUntil - Date.now())}</strong>
                        </div>
                    </div>
                ) : null}

                {/* Main Stats Card */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">Today's Usage</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white" aria-live="polite">
                                {formatSeconds(usage)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500 mb-1">Daily Limit</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                {limit ? `${limit} minutes` : 'No limit'}
                            </div>
                        </div>
                    </div>

                    <ProgressBar value={percentUsed()} />
                    <div className="flex justify-between items-center mt-2">
                        <div className="text-sm text-gray-500">Usage Progress</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{percentUsed()}% used</div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        onClick={() => applyLimit(15)}
                    >
                        15m
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        onClick={() => applyLimit(30)}
                    >
                        30m
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                        onClick={() => applyLimit(60)}
                    >
                        60m
                    </motion.button>

                    {!blocked ? (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="col-span-3 px-3 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                            onClick={blockNow}
                        >
                            <ShieldExclamationIcon className="w-4 h-4" />
                            Block This Site
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="col-span-3 px-3 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                            onClick={unblock}
                        >
                            Unblock This Site
                        </motion.button>
                    )}
                </div>

                {/* Focus & Tools Section */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
                        onClick={() => startFocus(25)}
                    >
                        🎯 Focus 25m
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        onClick={() => startFocus(50)}
                    >
                        ⏰ Focus 50m
                    </motion.button>
                    <button
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => snooze(10)}
                    >
                        😴 Snooze 10m
                    </button>
                    <button
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={exportCSV}
                    >
                        📊 Export Data
                    </button>
                </div>

                {/* Analytics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Trend Graph */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Usage Overview</div>
                        <UsageChart labels={['S', 'M', 'T', 'W', 'T', 'F', 'S']} data={trend.map(x => x * 60)} categories={categoryAgg} />
                    </div>

                    {/* Streaks */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Focus Streaks</div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Current</span>
                                <span className="text-lg font-bold text-green-600">{streaks.current} days</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Best</span>
                                <span className="text-lg font-bold text-purple-600">{streaks.best} days</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Sites & Predictions */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Top Sites */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">Top Sites</div>
                        <div className="space-y-2">
                            {topDomains.slice(0, 6).map((t, index) => (
                                <div key={t.domain}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, index)}
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDrop(e, index)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Top site ${index + 1} ${t.domain}`}
                                    className={`flex justify-between items-center text-sm p-1 rounded ${dragIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                >
                                    <span className="truncate flex-1 mr-2 text-gray-700 dark:text-gray-300">
                                        {index + 1}. {t.domain}
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                                        {t.minutes ? `${t.minutes}m` : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Predictions */}
                    {predictedDomains.length > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 border border-orange-200 dark:border-orange-800">
                            <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">⚠️ Likely Distractions</div>
                            <div className="space-y-1">
                                {predictedDomains.slice(0, 3).map(t => (
                                    <button
                                        key={t.domain}
                                        className="w-full text-left px-2 py-1 text-xs bg-orange-100 dark:bg-orange-800/30 rounded hover:bg-orange-200 dark:hover:bg-orange-700/40 transition-colors text-orange-700 dark:text-orange-300"
                                        onClick={() => chrome.runtime.sendMessage({ action: 'block-now', domain: t.domain })}
                                    >
                                        {t.domain}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="text-sm text-gray-500 font-medium">SiteFuse — Focus Made Simple</div>
                    <div className="text-xs text-gray-400">v1.0</div>
                </div>
            </motion.div>
        </div>
    )
}