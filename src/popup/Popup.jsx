import React, { useEffect, useState } from 'react'
import { getStorage, setStorage, getUsageLast7Days, blockDomain, unblockDomain, setLimit as storageSetLimit, getAll, ensureDomainCategory, exportAllToCSV } from '../utils/storage'
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
    return (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2" style={{ width: `${Math.min(100, value)}%` }} />
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
    const [trend, setTrend] = useState([0, 0, 0, 0, 0, 0, 0])

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
            const th = (all.theme || 'light')
            setTheme(th)
            document.documentElement.classList.toggle('dark', th === 'dark')
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

    function toggleTheme() {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        setStorage({ theme: next })
        document.documentElement.classList.toggle('dark', next === 'dark')
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

    const suggestion = (limit && limit > 0 && usage > 0 && usage / (limit * 60) > 0.75) || (!limit && usage > 60 * 30)

    return (
        <div className="min-w-[320px] p-4 font-sans">
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <img src={fav} alt="favicon" className="w-8 h-8 rounded-sm" />
                        <div>
                            <div className="text-sm text-gray-500 dark:text-gray-300">Active</div>
                            <div className="text-lg font-semibold truncate">{domain || '—'}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button aria-label="Theme toggle" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" onClick={toggleTheme}>
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <a className="text-sm text-gray-500 dark:text-gray-300" href="options.html">Settings</a>
                    </div>
                </div>

                <div className="mb-3">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <div className="text-xs text-gray-500">Today</div>
                            <div className="text-2xl font-bold">{formatSeconds(usage)}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500">Limit</div>
                            <div className="text-lg font-semibold">{limit ? `${limit} min` : 'None'}</div>
                        </div>
                    </div>
                    <div className="mt-3">
                        <ProgressBar value={percentUsed()} />
                        <div className="text-xs text-gray-500 mt-2">{percentUsed()}% used</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-xs text-gray-500">Quick set limit</label>
                        <div className="flex gap-2 mt-2">
                            <button className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white" onClick={() => applyLimit(10)}>10m</button>
                            <button className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white" onClick={() => applyLimit(25)}>25m</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">Actions</label>
                        <div className="flex gap-2 mt-2">
                            {!blocked ? (
                                <button className="flex-1 px-3 py-2 rounded bg-red-600 text-white" onClick={blockNow}><ShieldExclamationIcon className="w-4 h-4 inline-block mr-2" />Block</button>
                            ) : (
                                <button className="flex-1 px-3 py-2 rounded bg-green-600 text-white" onClick={unblock}>Unblock</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-2">Last 7 days (minutes)</div>
                    <div className="flex items-end gap-2 h-20">
                        {trend.map((v, i) => (
                            <motion.div key={i} initial={{ height: 2 }} animate={{ height: `${Math.max(4, (v / (Math.max(...trend) || 1)) * 80)}%` }} className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-t" style={{ height: `${Math.max(4, (v / (Math.max(...trend) || 1)) * 100)}%` }} title={`${v}m`} />
                        ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button className="px-3 py-2 rounded border" onClick={exportCSV}>Export CSV</button>
                        <button className="px-3 py-2 rounded border" onClick={() => snooze(5)}>Snooze 5m</button>
                        {suggestion ? <button className="px-3 py-2 rounded bg-yellow-500 text-white" onClick={() => applyLimit(Math.max(10, Math.floor(usage / 60)))}>Suggest Limit</button> : null}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
