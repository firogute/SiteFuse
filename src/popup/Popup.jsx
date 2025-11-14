import React, { useEffect, useState, useRef } from 'react'
import { getStorage, setStorage, getUsageLast7Days, blockDomain, unblockDomain, setLimit as storageSetLimit, getAll, ensureDomainCategory, exportAllToCSV, getAggregatedUsageByCategory, getTopDomains, getStreaks, getPredictedDistractions } from '../utils/storage'
import Badges from './Badges'
import StreakCalendar from './StreakCalendar'
import { categorizeDomain, defaultLimitForCategory } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { Cog6ToothIcon, ShieldExclamationIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { getFaviconForDomain } from '../utils/favicons'

function formatSeconds(s) {
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
}

function ProgressBar({ value = 0 }) {
    const pct = Math.min(100, Math.max(0, value))
    return (
        <div className="sf-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="sf-progress-bar" style={{ width: `${pct}%` }} />
        </div>
    )
}

export default function Popup() {
    const [domain, setDomain] = useState(null)
    const [usage, setUsage] = useState(0)
    const [limit, setLimit] = useState(null)
    const [blocked, setBlocked] = useState(false)
    const [fav, setFav] = useState(null)
    const [theme, setTheme] = useState('auto')
    const sysPref = useRef(null)
    const [trend, setTrend] = useState([0, 0, 0, 0, 0, 0, 0])
    const [categoryAgg, setCategoryAgg] = useState({})
    const [topDomains, setTopDomains] = useState([])
    const [streaks, setStreaks] = useState({ current: 0, best: 0 })

    useEffect(() => {
        (async () => {
            const tabs = await new Promise((r) => chrome.tabs.query({ active: true, lastFocusedWindow: true }, r))
            const tab = tabs[0]
            const d = tab && tab.url ? new URL(tab.url).hostname : null
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
                const top = await getTopDomains(6)
                setTopDomains(top)
                const s = await getStreaks()
                setStreaks(s)
                try {
                    const preds = await getPredictedDistractions()
                    setTopDomains(preds.slice(0, 6))
                } catch (e) { }
            } catch (e) { }
        })()
    }, [])

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

    function Sparkline({ data = [] }) {
        const w = 120
        const h = 28
        const max = Math.max(...data, 1)
        const points = data.map((v, i) => {
            const x = (i / Math.max(1, data.length - 1)) * w
            const y = h - (v / max) * (h - 4) - 2
            return `${x},${y}`
        }).join(' ')
        return (
            <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} aria-hidden>
                <polyline fill="none" stroke="#7c3aed" strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )
    }

    const suggestion = (limit && limit > 0 && usage > 0 && usage / (limit * 60) > 0.75) || (!limit && usage > 60 * 30)

    return (
        <div className="popup-root font-sans">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="popup-card">
                <header className="popup-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <img src={fav || '/icon128.png'} alt={`${domain || 'site'} favicon`} className="w-8 h-8 rounded-sm" />
                        <div style={{ minWidth: 0 }}>
                            <div className="muted-small">Active</div>
                            <div className="text-lg font-semibold truncate">{domain || '—'}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <motion.button aria-label="Theme toggle" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="p-1.5 w-8 h-8 rounded-md sf-transition focus-ring btn-no-outline" onClick={toggleTheme}>
                            {theme === 'dark' ? <SunIcon className="w-4 h-4 icon-accent" /> : theme === 'light' ? <MoonIcon className="w-4 h-4 icon-muted" /> : <Cog6ToothIcon className="w-4 h-4 icon-muted" />}
                        </motion.button>
                        <a className="text-sm muted-small btn-no-outline" href="/options.html">Settings</a>
                    </div>
                </header>

                <main className="popup-main mt-3">
                    <section>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.6rem' }}>
                            <div>
                                <div className="muted-small">Today</div>
                                <div className="text-2xl font-bold" aria-live="polite">{formatSeconds(usage)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="muted-small">Limit</div>
                                <div className="text-lg font-semibold">{limit ? `${limit} min` : 'None'}</div>
                            </div>
                        </div>
                        <div className="mt-3">
                            <ProgressBar value={percentUsed()} />
                            <div className="muted-small mt-2">{percentUsed()}% used</div>
                        </div>

                        <div className="mt-3 popup-actions">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sf-btn-primary flex-1" onClick={() => applyLimit(10)}>10m</motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sf-btn-primary flex-1" onClick={() => applyLimit(25)}>25m</motion.button>
                            {!blocked ? (
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sf-btn-primary flex-1" onClick={blockNow}><ShieldExclamationIcon className="w-4 h-4 inline-block mr-2" />Block</motion.button>
                            ) : (
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sf-btn-primary flex-1" onClick={unblock}>Unblock</motion.button>
                            )}
                        </div>

                        <div className="mt-3" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button className="sf-btn-ghost" onClick={() => startFocus(25)}>Focus 25m</button>
                            <button className="sf-btn-ghost" onClick={() => startFocus(50)}>Focus 50m</button>
                            <button className="sf-btn-ghost" onClick={() => snooze(5)}>Snooze</button>
                            <button className="sf-btn-ghost" onClick={exportCSV}>Export</button>
                        </div>

                        <div className="mt-3">
                            <div className="muted-small mb-1">Last 7 days</div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'end', height: 64 }}>
                                {trend.map((v, i) => {
                                    const max = Math.max(...trend) || 1
                                    const h = Math.max(6, Math.round((v / max) * 56))
                                    return <div key={i} title={`${v}m`} style={{ flex: 1, height: `${h}px`, background: 'linear-gradient(180deg,var(--accent),#ec4899)', borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                                })}
                            </div>
                        </div>
                    </section>

                    <aside>
                        <div className="popup-analytics">
                            <div className="card" style={{ padding: '0.6rem' }}>
                                <div className="muted-small">Prediction</div>
                                <div className="mt-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {topDomains.length === 0 && <div className="muted-small">No predictions</div>}
                                    {topDomains.map(t => (
                                        <button key={t.domain} className="chip" onClick={() => chrome.runtime.sendMessage({ action: 'block-now', domain: t.domain })}>{t.domain}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="card" style={{ padding: '0.6rem' }}>
                                <div className="muted-small">Analytics</div>
                                <div className="mt-2 muted-small">Streaks: <strong>{streaks.current}</strong> / Best <strong>{streaks.best}</strong></div>
                                <div className="mt-2">
                                    <div className="muted-small mb-1">Top Sites</div>
                                    <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', fontSize: '0.9rem' }}>
                                        {topDomains.map(t => (<li key={t.domain} style={{ marginBottom: 6 }}><strong style={{ color: 'var(--text)' }}>{t.domain}</strong><div className="muted-small">{t.minutes ? `${t.minutes}m` : ''}</div></li>))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </aside>
                </main>
                <footer style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <div className="muted-small">SiteFuse — Focus made simple</div>
                    <div className="muted-small">v1.0</div>
                </footer>
            </motion.div>
        </div>
    )

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
}
