import React, { useEffect, useState, useMemo } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days, getStorage, setStorage, getSchedules, addSchedule, removeSchedule, getWhitelist, addWhitelist, removeWhitelist, getCategoriesList, addCategory, removeCategory, assignDomainToCategory, getDomainsForCategory, getCoins, spendCoins } from '../utils/storage'
import { knownCategories, defaultLimitForCategory, categorizeDomain } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { TrashIcon, BellAlertIcon, ArrowLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import DomainsPanel from './components/DomainsPanel'
import SocialPanel from './components/SocialPanel'
import WhitelistPanel from './components/WhitelistPanel'
import CategoriesPanel from './components/CategoriesPanel'
import { DomainDetail as DomainDetailModal } from './components/UI'

// UI helpers
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))

function UsageBar({ value, label }) {
    const pct = clamp(value || 0)
    const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-indigo-500'
    return (
        <div className="w-full">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <div>{label}</div>
                <div className="font-semibold">{pct}%</div>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className={`h-3 ${color} rounded-full transition-all duration-500`}
                />
            </div>
        </div>
    )
}

function CategoryDefault({ category }) {
    const [val, setVal] = useState('')
    useEffect(() => {
        (async () => {
            const s = await getStorage(['categoryDefaults'])
            const defs = s.categoryDefaults || {}
            setVal(defs[category] || '')
        })()
    }, [category])

    async function save() {
        const mins = parseInt(val, 10)
        if (isNaN(mins)) return
        const s = await getStorage(['categoryDefaults'])
        const defs = s.categoryDefaults || {}
        defs[category] = mins
        await setStorage({ categoryDefaults: defs })
    }

    return (
        <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">{category}</div>
            <div className="flex gap-2">
                <input
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder="Minutes"
                    type="number"
                />
                <button
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                    onClick={save}
                >
                    Save
                </button>
            </div>
        </div>
    )
}

function ScheduleForm({ onAdd }) {
    const [type, setType] = useState('category')
    const [target, setTarget] = useState('social')
    const [days, setDays] = useState([1, 2, 3, 4, 5])
    const [start, setStart] = useState('21:00')
    const [end, setEnd] = useState('07:00')

    function toggleDay(d) {
        setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : ds.concat([d]))
    }

    async function save() {
        const entry = { type, target, days, start, end, enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        await addSchedule(entry)
        onAdd && onAdd()
    }

    return (
        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Add Schedule</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                    <select
                        value={type}
                        onChange={e => setType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="category">Category</option>
                        <option value="domain">Domain</option>
                    </select>
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target</label>
                    <input
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={target}
                        onChange={e => setTarget(e.target.value)}
                        placeholder="category or domain"
                    />
                </div>
            </div>

            <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days</label>
                <div className="grid grid-cols-7 gap-1">
                    {[0, 1, 2, 3, 4, 5, 6].map(d => (
                        <button
                            key={d}
                            onClick={() => toggleDay(d)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${days.includes(d)
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                    <input
                        type="time"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                    <input
                        type="time"
                        value={end}
                        onChange={e => setEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <button
                className="w-full px-4 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onClick={save}
            >
                Add Schedule
            </button>
        </div>
    )
}

function ScheduleList({ refreshKey }) {
    const [schedules, setSchedules] = useState([])
    useEffect(() => {
        (async () => {
            const s = await getSchedules()
            setSchedules(s)
        })()
    }, [refreshKey])

    return (
        <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Active Schedules</h3>
            <div className="space-y-3">
                {schedules.length === 0 && (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Cog6ToothIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No schedules configured</p>
                    </div>
                )}
                {schedules.map(s => (
                    <div key={s.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                                    {s.type}: {s.target}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {s.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {s.start} - {s.end}
                                </div>
                            </div>
                            <button
                                className="px-3 py-1 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                onClick={async () => { await removeSchedule(s.id); setSchedules(await getSchedules()) }}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function Options() {
    const [data, setData] = useState({ limits: {}, blocked: {}, usage: {} })
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState({})
    const [domainInput, setDomainInput] = useState('')
    const [limitInput, setLimitInput] = useState('')
    const [activeTab, setActiveTab] = useState('domains')
    const [detailDomain, setDetailDomain] = useState(null)
    const [socialList, setSocialList] = useState([])
    const [socialCatLimit, setSocialCatLimit] = useState('')
    const [coins, setCoins] = useState(0)
    const [whitelist, setWhitelist] = useState([])
    const [whitelistInput, setWhitelistInput] = useState('')
    const [categoriesCustom, setCategoriesCustom] = useState([])
    const [newCategoryName, setNewCategoryName] = useState('')

    useEffect(() => {
        (async () => {
            const all = await getAll()
            setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
            const s = await getStorage(['categoryDefaults'])
            if (!s.categoryDefaults) {
                const defs = {}
                for (const c of knownCategories()) defs[c] = defaultLimitForCategory(c)
                await setStorage({ categoryDefaults: defs })
            }
            try {
                const t = (await getStorage(['theme'])).theme || 'auto'
                const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
                const isDark = t === 'dark' || (t === 'auto' && sys && sys.matches)
                document.documentElement.classList.toggle('dark', isDark)
            } catch (e) { }
            try {
                const c = await getCoins()
                setCoins(c || 0)
            } catch (e) { }
        })()
    }, [])

    // Listen to storage changes so the UI reflects live usage updates
    useEffect(() => {
        function onStorage(changes, area) {
            if (area !== 'local') return
            if (changes.usage || changes.limits || changes.blocked || changes.grace) {
                ; (async () => {
                    const all = await getAll()
                    setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
                })()
            }
        }
        try { chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener(onStorage) } catch (e) { }
        return () => { try { chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.removeListener(onStorage) } catch (e) { } }
    }, [])

    useEffect(() => {
        function onMessage(msg) {
            if (!msg || msg.action !== 'theme-changed') return
            const t = msg.theme || 'auto'
            try {
                if (t === 'auto') {
                    const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
                    document.documentElement.classList.toggle('dark', sys && sys.matches)
                } else {
                    document.documentElement.classList.toggle('dark', t === 'dark')
                }
            } catch (e) { }
        }
        try { chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.addListener(onMessage) } catch (e) { }
        return () => { try { chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.removeListener(onMessage) } catch (e) { } }
    }, [])

    // While a domain detail modal is open, refresh data every second so the modal shows live usage/grace countdown.
    useEffect(() => {
        if (!detailDomain) return
        let t = setInterval(async () => {
            try {
                const all = await getAll()
                setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
            } catch (e) { }
        }, 1000)
        return () => clearInterval(t)
    }, [detailDomain])

    useEffect(() => {
        (async () => {
            try {
                const all = await getAll()
                const keys = new Set([...(Object.keys(all.limits || {})), ...(Object.keys(all.blocked || {})), ...(Object.keys(all.usage || {}))])
                const socials = []
                for (const d of Array.from(keys)) {
                    if (categorizeDomain(d) === 'social') {
                        const last7 = await getUsageLast7Days(d).catch(() => [])
                        const minutes = last7.reduce((a, b) => a + b, 0)
                        const avg = Math.round((minutes / 7) || 0)
                        socials.push({ domain: d, minutes, avg })
                    }
                }
                setSocialList(socials.sort((a, b) => b.minutes - a.minutes))
            } catch (e) { }
            try {
                const s = await getStorage(['categoryDefaults'])
                setSocialCatLimit((s.categoryDefaults && s.categoryDefaults.social) || '')
            } catch (e) { }
        })()
    }, [data])

    useEffect(() => {
        (async () => {
            try {
                const wl = await getWhitelist()
                setWhitelist(wl)
            } catch (e) { }
            try {
                const cls = await getCategoriesList()
                setCategoriesCustom(cls || [])
            } catch (e) { }
        })()
    }, [data])

    const domains = useMemo(() => {
        const keys = new Set([...Object.keys(data.limits || {}), ...Object.keys(data.blocked || {}), ...Object.keys(data.usage || {})])
        return Array.from(keys).filter(d => d.includes(query)).sort()
    }, [data, query])

    async function addLimit() {
        const d = domainInput.trim()
        const mins = parseInt(limitInput, 10)
        if (!d || isNaN(mins)) return
        await setLimit(d, mins)
        const all = await getAll()
        setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
        setDomainInput('')
        setLimitInput('')
    }

    async function remove(d) {
        await removeLimit(d)
        const all = await getAll()
        setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
    }

    async function toggleBlocked(d) {
        const isBlocked = !!data.blocked[d]
        if (isBlocked) await unblockDomain(d)
        else await blockDomain(d)
        const all = await getAll()
        setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
    }

    async function batchSetLimit(mins) {
        const toSet = Object.keys(selected).filter(k => selected[k])
        for (const d of toSet) {
            await setLimit(d, mins)
        }
        const all = await getAll()
        setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
    }

    const setLimitHandler = async (dom, preset) => {
        const mins = prompt('Set minutes for ' + dom, (data.limits[dom] || preset || 15))
        const m = parseInt(mins, 10)
        if (!isNaN(m)) {
            await setLimit(dom, m)
            const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
        }
    }

    const suggestBlockHandler = async (dom) => {
        const defs = (await getStorage(['categoryDefaults'])).categoryDefaults || {}
        const def = parseInt(defs.social || defaultLimitForCategory('social'), 10)
        const last7 = await getUsageLast7Days(dom).catch(() => [])
        const avg = Math.round((last7.reduce((a, b) => a + b, 0) / 7) || 0)
        if (avg >= Math.round(def * 0.75)) {
            await blockDomain(dom)
            const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
        } else {
            alert(`${dom} is not above the suggestion threshold`)
        }
    }

    return (
        <div className="app-root font-sans px-4 py-6 min-w-[350px] max-w-[350px] mx-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            aria-label="Back"
                            onClick={() => { try { window.location.href = '/popup.html' } catch (e) { try { window.history.back() } catch (ee) { } } }}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SiteFuse</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Manage domains, limits and categories</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">⭐ {coins} coins</div>
                        <button
                            className="px-3 py-2 rounded-lg bg-amber-500 text-white text-sm hover:bg-amber-600 transition-colors"
                            onClick={async () => {
                                try {
                                    if ((await spendCoins(50)) !== undefined) {
                                        alert('Theme unlocked! Check the theme picker.');
                                        const c = await getCoins(); setCoins(c || 0)
                                    }
                                } catch (e) { alert('Not enough coins') }
                            }}
                        >Unlock Theme (50)</button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex gap-2 mb-6">
                    <input
                        placeholder="Search domains..."
                        className="flex-1 min-w-0 px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                        onClick={() => { setSelected({}); setQuery(''); }}
                    >
                        Reset
                    </button>
                </div>

                {/* Main Content */}
                <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl p-4 shadow-sm">
                    {/* Tabs */}
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="flex gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-xl">
                            {['domains', 'social', 'whitelist', 'categories'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 px-4 py-3 rounded-lg text-sm text-center min-w-0 transition-all font-medium ${activeTab === tab
                                        ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {tab === 'domains' ? 'Sites' :
                                        tab === 'social' ? 'Social' :
                                            tab === 'whitelist' ? 'Allow List' :
                                                'Categories'}
                                </button>
                            ))}
                        </div>

                        {/* Bulk Actions */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors font-medium"
                                onClick={() => batchSetLimit(15)}
                            >
                                15m
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors font-medium"
                                onClick={() => batchSetLimit(30)}
                            >
                                30m
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors font-medium"
                                onClick={() => batchSetLimit(60)}
                            >
                                60m
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="mb-6 max-h-[400px] overflow-y-auto pr-2">
                        {activeTab === 'domains' && (
                            <DomainsPanel
                                domains={domains}
                                data={data}
                                selected={selected}
                                setSelected={setSelected}
                                domainInput={domainInput}
                                setDomainInput={setDomainInput}
                                limitInput={limitInput}
                                setLimitInput={setLimitInput}
                                addLimit={addLimit}
                                remove={remove}
                                toggleBlocked={toggleBlocked}
                                setLimitHandler={setLimitHandler}
                                suggestBlockHandler={suggestBlockHandler}
                                onOpenDetail={(dom) => setDetailDomain(dom)}
                                bulkSetLimit={batchSetLimit}
                            />
                        )}

                        {activeTab === 'social' && (
                            <SocialPanel
                                socialList={socialList}
                                socialCatLimit={socialCatLimit}
                                setSocialCatLimit={setSocialCatLimit}
                                onSave={async () => {
                                    const mins = parseInt(socialCatLimit, 10)
                                    if (isNaN(mins)) return
                                    const s = await getStorage(['categoryDefaults'])
                                    const defs = s.categoryDefaults || {}
                                    defs.social = mins
                                    await setStorage({ categoryDefaults: defs })
                                    const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
                                }}
                                onBlock={async (dom) => { await blockDomain(dom); const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }}
                                onSuggest={suggestBlockHandler}
                            />
                        )}

                        {activeTab === 'whitelist' && (
                            <WhitelistPanel
                                whitelist={whitelist}
                                whitelistInput={whitelistInput}
                                setWhitelistInput={setWhitelistInput}
                                onAdd={async () => { const d = whitelistInput.trim(); if (!d) return; await addWhitelist(d); setWhitelist(await getWhitelist()); setWhitelistInput('') }}
                                onRemove={async (w) => { await removeWhitelist(w); setWhitelist(await getWhitelist()) }}
                            />
                        )}

                        {activeTab === 'categories' && (
                            <CategoriesPanel
                                knownCategoriesList={knownCategories()}
                                categoriesCustom={categoriesCustom}
                                newCategoryName={newCategoryName}
                                setNewCategoryName={setNewCategoryName}
                                onCreateCategory={async () => { const n = newCategoryName.trim(); if (!n) return; await addCategory(n); setCategoriesCustom(await getCategoriesList()); setNewCategoryName('') }}
                                refreshData={async () => { const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }}
                            />
                        )}
                    </div>

                    {/* Sidebar Content */}
                    <div className="space-y-6 border-t pt-6">
                        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Defaults</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {knownCategories().map(c => (
                                    <CategoryDefault key={c} category={c} />
                                ))}
                            </div>
                        </div>

                        <ScheduleForm onAdd={async () => { const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }} />
                        <ScheduleList refreshKey={Math.random()} />
                    </div>
                </div>
            </motion.div>

            {detailDomain && (
                <DomainDetailModal
                    domain={detailDomain}
                    data={data}
                    onClose={() => setDetailDomain(null)}
                    onRemove={async (dom) => { await remove(dom); setDetailDomain(null) }}
                    onToggleBlocked={async (dom) => { await toggleBlocked(dom); }}
                    onSetLimit={async (dom, mins) => { await setLimit(dom, mins); const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }); }}
                />
            )}
        </div>
    )
}