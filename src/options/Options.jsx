import React, { useEffect, useState, useMemo } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days, getStorage, setStorage, getSchedules, addSchedule, removeSchedule, getWhitelist, addWhitelist, removeWhitelist, getCategoriesList, addCategory, removeCategory, assignDomainToCategory, getDomainsForCategory } from '../utils/storage'
import { knownCategories, defaultLimitForCategory, categorizeDomain } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { TrashIcon, BellAlertIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
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
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <div className="text-xs">{label}</div>
                <div className="font-semibold text-xs">{pct}%</div>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-2 ${color}`} />
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
        <div className="p-2 border rounded bg-white dark:bg-gray-800">
            <div className="text-xs text-gray-500 mb-1">{category}</div>
            <div className="flex gap-1">
                <input
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                />
                <button
                    className="px-2 py-1 rounded bg-indigo-600 text-white text-xs min-w-[40px]"
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
        <div className="p-3 border rounded mb-3 bg-white dark:bg-gray-800">
            <div className="flex flex-col gap-2 mb-2">
                <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                >
                    <option value="category">Category</option>
                    <option value="domain">Domain</option>
                </select>
                <input
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="category or domain"
                />
            </div>
            <div className="text-xs text-gray-500 mb-1">Days</div>
            <div className="flex flex-wrap gap-1 mb-2">
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                    <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={`px-2 py-1 rounded text-xs min-w-[28px] ${days.includes(d)
                            ? 'bg-indigo-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600'
                            }`}
                    >
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d].slice(0, 3)}
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-2">
                <input
                    type="time"
                    value={start}
                    onChange={e => setStart(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                />
                <input
                    type="time"
                    value={end}
                    onChange={e => setEnd(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700"
                />
                <button
                    className="w-full px-2 py-1 rounded bg-indigo-600 text-white text-sm"
                    onClick={save}
                >
                    Add Schedule
                </button>
            </div>
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
        <div className="mb-3">
            <h3 className="text-sm font-semibold mb-2">Schedules</h3>
            <div className="space-y-2">
                {schedules.length === 0 && <div className="text-xs text-gray-500">No schedules configured</div>}
                {schedules.map(s => (
                    <div key={s.id} className="p-2 border rounded bg-white dark:bg-gray-800">
                        <div className="text-xs">
                            <div><strong>{s.type}</strong> — {s.target}</div>
                            <div className="text-xs text-gray-500">
                                {s.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d].slice(0, 3)).join(', ')} {s.start}-{s.end}
                            </div>
                        </div>
                        <button
                            className="w-full mt-1 px-2 py-1 rounded border border-gray-300 text-xs bg-white dark:bg-gray-700"
                            onClick={async () => { await removeSchedule(s.id); setSchedules(await getSchedules()) }}
                        >
                            Remove
                        </button>
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
        <div className="app-root font-sans px-3 py-4 min-w-[200px] max-w-[200px] mx-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                {/* Header */}
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            aria-label="Back"
                            onClick={() => { try { window.location.href = '/popup.html' } catch (e) { try { window.history.back() } catch (ee) { } } }}
                            className="p-2 rounded bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800"
                        >
                            <ArrowLeftIcon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">SiteFuse</h1>
                            <p className="text-xs text-gray-500">Manage domains & limits</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <input
                            placeholder="Search domains..."
                            className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => { setSelected({}); setQuery(''); }}
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    {/* Tabs */}
                    <div className="flex flex-col gap-3 mb-4">
                        <div className="flex gap-1 bg-gray-50 dark:bg-gray-800 p-1 rounded-lg">
                            {['domains', 'social', 'whitelist', 'categories'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 px-2 py-2 rounded text-sm text-center min-w-0 transition-colors ${activeTab === tab
                                        ? 'bg-white dark:bg-gray-900 shadow-sm font-medium text-gray-900 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {tab === 'domains' ? 'Sites' :
                                        tab === 'social' ? 'Social' :
                                            tab === 'whitelist' ? 'Allow' :
                                                'Categories'}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm text-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                onClick={() => batchSetLimit(15)}
                            >
                                Set 15m
                            </button>
                            <button
                                className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm text-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                onClick={() => batchSetLimit(30)}
                            >
                                Set 30m
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="mb-4 max-h-[300px] overflow-y-auto pr-1">
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
                    <div className="space-y-4 border-t pt-4">
                        <div className="p-3 border rounded-lg bg-white dark:bg-gray-800">
                            <h3 className="text-sm font-semibold mb-3">Category Defaults</h3>
                            <div className="grid grid-cols-2 gap-2">
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