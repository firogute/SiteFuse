import React, { useEffect, useState, useMemo, useRef } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days, getStorage, setStorage, getSchedules, addSchedule, removeSchedule, getWhitelist, addWhitelist, removeWhitelist, getCategoriesList, addCategory, removeCategory, assignDomainToCategory, getDomainsForCategory } from '../utils/storage'
import { knownCategories, defaultLimitForCategory, categorizeDomain } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { TrashIcon, BellAlertIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

function formatUsage(s) {
    if (!s) return '0m 0s'
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
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
        <div className="p-2 border rounded card-elevate">
            <div className="text-xs muted-small">{category}</div>
            <div className="mt-2 flex gap-2">
                <input className="sf-input flex-1 text-sm" value={val} onChange={(e) => setVal(e.target.value)} />
                <button className="px-2 py-1 rounded sf-btn-primary text-sm" onClick={save}>Save</button>
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
        <div className="p-3 border rounded mb-4 card-elevate">
            <div className="flex gap-2 items-center">
                <select value={type} onChange={e => setType(e.target.value)} className="sf-input">
                    <option value="category">Category</option>
                    <option value="domain">Domain</option>
                </select>
                <input className="sf-input flex-1" value={target} onChange={e => setTarget(e.target.value)} placeholder="category or domain" />
            </div>
            <div className="mt-2 text-sm text-gray-500">Days</div>
            <div className="flex gap-1 mt-1">
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                    <button key={d} onClick={() => toggleDay(d)} className={`px-2 py-1 rounded ${days.includes(d) ? 'bg-indigo-600 text-white' : 'border'}`}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}</button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
                <input type="time" value={start} onChange={e => setStart(e.target.value)} className="sf-input" />
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="sf-input" />
                <button className="px-3 py-2 rounded sf-btn-primary" onClick={save}>Add Schedule</button>
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
        <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Schedules</h3>
            <div className="space-y-2">
                {schedules.length === 0 && <div className="text-sm text-gray-500">No schedules configured.</div>}
                {schedules.map(s => (
                    <div key={s.id} className="p-2 border rounded flex items-center justify-between">
                        <div className="text-sm">
                            <div><strong>{s.type}</strong> — {s.target}</div>
                            <div className="text-xs text-gray-500">{s.days.join(', ')} {s.start} — {s.end} <span className="ml-2">({s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone})</span></div>
                        </div>
                        <div>
                            <button className="px-2 py-1 rounded border mr-2" onClick={async () => { await removeSchedule(s.id); setSchedules(await getSchedules()) }}>Remove</button>
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
    const [socialList, setSocialList] = useState([])
    const [socialCatLimit, setSocialCatLimit] = useState('')
    const [whitelist, setWhitelist] = useState([])
    const [whitelistInput, setWhitelistInput] = useState('')
    const [categoriesCustom, setCategoriesCustom] = useState([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [categoryDomains, setCategoryDomains] = useState([])
    const [assignDomainInput, setAssignDomainInput] = useState('')

    useEffect(() => {
        (async () => {
            const all = await getAll()
            setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
            // ensure category defaults exist
            const s = await getStorage(['categoryDefaults'])
            if (!s.categoryDefaults) {
                const defs = {}
                for (const c of knownCategories()) defs[c] = defaultLimitForCategory(c)
                await setStorage({ categoryDefaults: defs })
            }
            // apply theme from storage (supports 'auto') and listen for changes
            try {
                const t = (await getStorage(['theme'])).theme || 'auto'
                const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
                const isDark = t === 'dark' || (t === 'auto' && sys && sys.matches)
                document.documentElement.classList.toggle('dark', isDark)
            } catch (e) { }
        })()
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

    useEffect(() => {
        // compute detected social domains and current social category default
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
        // load whitelist and custom categories
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

    useEffect(() => {
        // load domains for selected category
        (async () => {
            if (!selectedCategory) return setCategoryDomains([])
            try {
                const doms = await getDomainsForCategory(selectedCategory)
                setCategoryDomains(doms)
            } catch (e) { setCategoryDomains([]) }
        })()
    }, [selectedCategory, data])

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

    return (
        <div className="app-root font-sans">
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="panel" role="main" aria-labelledby="domains-heading">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button aria-label="Back" title="Back to main" onClick={() => { try { window.location.href = '/popup.html' } catch (e) { try { window.history.back() } catch (ee) { /* nothing */ } } }} className="p-1 rounded btn-no-outline">
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 id="domains-heading" className="text-xl font-semibold">SiteFuse — Domains</h2>
                            <p className="text-sm text-gray-500">Manage tracked domains and limits</p>
                        </div>
                    </div>
                    <div className="header-controls">
                        <div className="tabs" role="tablist" aria-label="Options tabs">
                            <button aria-selected={activeTab === 'domains'} onClick={() => setActiveTab('domains')} className={activeTab === 'domains' ? 'bg-active' : ''}>Domains</button>
                            <button aria-selected={activeTab === 'social'} onClick={() => setActiveTab('social')} className={activeTab === 'social' ? 'bg-active' : ''}>Social</button>
                            <button aria-selected={activeTab === 'whitelist'} onClick={() => setActiveTab('whitelist')} className={activeTab === 'whitelist' ? 'bg-active' : ''}>Whitelist</button>
                            <button aria-selected={activeTab === 'categories'} onClick={() => setActiveTab('categories')} className={activeTab === 'categories' ? 'bg-active' : ''}>Categories</button>
                        </div>
                        <input placeholder="Search domains" className="sf-input search-input" value={query} onChange={(e) => setQuery(e.target.value)} />
                        <button className="px-3 py-2 rounded border text-sm btn-no-outline" onClick={() => { setSelected({}); setQuery(''); }}>Reset</button>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2">Category Defaults</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {knownCategories().map((c) => (
                            <CategoryDefault key={c} category={c} />
                        ))}
                    </div>
                </div>

                <ScheduleForm onAdd={async () => { const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }} />
                <ScheduleList refreshKey={Math.random()} />

                {/* Social media management panel */}
                {activeTab === 'social' && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-2">Social Media</h3>
                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <div className="col-span-1 sm:col-span-2">
                                <label className="text-sm font-medium">Category-wide limit for Social (minutes)</label>
                                <div className="mt-2 flex gap-2">
                                    <input className="sf-input" value={socialCatLimit} onChange={(e) => setSocialCatLimit(e.target.value)} placeholder="e.g. 30" />
                                    <button className="px-3 py-2 rounded bg-indigo-600 text-white btn-no-outline" onClick={async () => {
                                        const mins = parseInt(socialCatLimit, 10)
                                        if (isNaN(mins)) return
                                        const s = await getStorage(['categoryDefaults'])
                                        const defs = s.categoryDefaults || {}
                                        defs.social = mins
                                        await setStorage({ categoryDefaults: defs })
                                        // refresh data
                                        const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
                                    }}>Save</button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {socialList.length === 0 && <div className="text-sm text-gray-500">No social domains tracked yet.</div>}
                            {socialList.map(s => (
                                <div key={s.domain} className="p-3 border rounded flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{s.domain}</div>
                                        <div className="text-xs muted-small">Last 7 days: <strong>{s.minutes}m</strong> — Avg/day: <strong>{s.avg}m</strong></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1 rounded border" onClick={() => blockDomain(s.domain)}>Block</button>
                                        <button className="px-3 py-1 rounded" onClick={async () => {
                                            const defs = (await getStorage(['categoryDefaults'])).categoryDefaults || {}
                                            const def = parseInt(defs.social || defaultLimitForCategory('social'), 10)
                                            if (s.avg >= Math.round(def * 0.75)) {
                                                await blockDomain(s.domain)
                                                const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
                                            } else {
                                                alert(`${s.domain} is not above the suggestion threshold`)
                                            }
                                        }}>Suggest Block</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                { /* Whitelist panel */}
                {activeTab === 'whitelist' && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-2">Whitelist (trusted sites)</h3>
                        <div className="mb-3 flex gap-2">
                            <input className="sf-input flex-1" placeholder="example.com" value={whitelistInput} onChange={(e) => setWhitelistInput(e.target.value)} />
                            <button className="px-3 py-2 rounded bg-green-600 text-white btn-no-outline" onClick={async () => {
                                const d = whitelistInput.trim()
                                if (!d) return
                                await addWhitelist(d)
                                setWhitelist(await getWhitelist())
                                setWhitelistInput('')
                            }}>Add</button>
                        </div>
                        <div className="space-y-2">
                            {whitelist.length === 0 && <div className="text-sm text-gray-500">No whitelist domains yet.</div>}
                            {whitelist.map(w => (
                                <div key={w} className="p-3 border-l-4 border-green-400 bg-green-50 dark:bg-green-900/30 rounded flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{w}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1 rounded border text-sm" onClick={async () => { await removeWhitelist(w); setWhitelist(await getWhitelist()) }}>Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                { /* Categories panel */}
                {activeTab === 'categories' && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-2">Categories</h3>
                        <div className="mb-3 flex gap-2">
                            <input className="sf-input" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                            <button className="px-3 py-2 rounded bg-indigo-600 text-white btn-no-outline" onClick={async () => {
                                const n = newCategoryName.trim()
                                if (!n) return
                                await addCategory(n)
                                setCategoriesCustom(await getCategoriesList())
                                setNewCategoryName('')
                            }}>Create</button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[...knownCategories(), ...categoriesCustom.map(c => c.name)].map(cn => (
                                <div key={cn} className="p-3 border rounded">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium">{cn}</div>
                                        <div className="text-xs muted-small">{cn === 'social' ? 'color: purple' : ''}</div>
                                    </div>
                                    <div className="mt-2 text-xs muted-small">Assign domains to this category or view assigned domains.</div>
                                    <div className="mt-3 flex gap-2">
                                        <input className="sf-input flex-1" placeholder="domain.com" value={assignDomainInput} onChange={(e) => setAssignDomainInput(e.target.value)} />
                                        <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={async () => { if (!assignDomainInput) return; await assignDomainToCategory(assignDomainInput.trim(), cn); setAssignDomainInput(''); setData(await getAll()); }}>{'Assign'}</button>
                                    </div>
                                    <div className="mt-3">
                                        <button className="text-sm text-gray-500" onClick={() => setSelectedCategory(cn)}>View assigned domains</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {selectedCategory && (
                            <div className="mt-4">
                                <h4 className="text-sm font-semibold">Domains in {selectedCategory}</h4>
                                <div className="space-y-2 mt-2">
                                    {categoryDomains.length === 0 && <div className="text-sm text-gray-500">No domains assigned.</div>}
                                    {categoryDomains.map(d => (
                                        <div key={d.domain} className="p-2 border rounded flex items-center justify-between">
                                            <div>{d.domain}</div>
                                            <div className="text-xs muted-small">{formatUsage(d.usage)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <input className="sf-input col-span-1 sm:col-span-2" placeholder="domain.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
                    <div className="flex gap-2">
                        <input className="sf-input flex-1" placeholder="minutes" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} />
                        <button className="px-3 py-2 rounded bg-indigo-600 text-white btn-no-outline" onClick={addLimit}>Add</button>
                    </div>
                </div>

                <div className="mb-3 flex items-center gap-3 flex-wrap">
                    <button className="px-3 py-2 rounded bg-indigo-500 text-white btn-no-outline" onClick={() => batchSetLimit(15)}>Set 15m for selected</button>
                    <button className="px-3 py-2 rounded bg-indigo-500 text-white btn-no-outline" onClick={() => batchSetLimit(30)}>Set 30m for selected</button>
                </div>

                <div className="overflow-auto scrollable">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-sm text-gray-500">
                                <th className="py-2 w-8"></th>
                                <th className="py-2">Domain</th>
                                <th className="py-2">Usage</th>
                                <th className="py-2">Limit</th>
                                <th className="py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {domains.length === 0 && (
                                <tr><td className="py-4" colSpan="5">No domains tracked yet.</td></tr>
                            )}
                            {domains.map((d) => (
                                <tr key={d} className="border-t">
                                    <td className="py-2 align-top"><input type="checkbox" checked={!!selected[d]} onChange={(e) => setSelected(s => ({ ...s, [d]: e.target.checked }))} aria-label={`Select ${d}`} /></td>
                                    <td className="py-2 align-top break-words">{d}</td>
                                    <td className="py-2 align-top">{formatUsage(data.usage[d])}</td>
                                    <td className="py-2 align-top">{data.limits[d] ? `${data.limits[d]} min` : '—'}</td>
                                    <td className="py-2 align-top">
                                        <button className="mr-2 px-2 py-1 rounded border text-sm" onClick={() => remove(d)} aria-label={`Remove limit for ${d}`}><TrashIcon className="w-4 h-4 inline-block" /> Remove</button>
                                        <button className="px-2 py-1 rounded bg-red-600 text-white text-sm" onClick={() => toggleBlocked(d)}>{data.blocked[d] ? 'Unblock' : 'Block'}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    )
}
