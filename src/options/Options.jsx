import React, { useEffect, useState, useMemo } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days, getStorage, setStorage, getSchedules, addSchedule, removeSchedule } from '../utils/storage'
import { knownCategories, defaultLimitForCategory } from '../utils/categories'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { TrashIcon, BellAlertIcon } from '@heroicons/react/24/outline'

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
        <div className="p-2 border rounded">
            <div className="text-xs text-gray-500">{category}</div>
            <div className="mt-2 flex gap-2">
                <input className="flex-1 p-1 rounded border text-sm" value={val} onChange={(e) => setVal(e.target.value)} />
                <button className="px-2 py-1 rounded bg-indigo-600 text-white text-sm" onClick={save}>Save</button>
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
        <div className="p-3 border rounded mb-4">
            <div className="flex gap-2 items-center">
                <select value={type} onChange={e => setType(e.target.value)} className="p-2 rounded border">
                    <option value="category">Category</option>
                    <option value="domain">Domain</option>
                </select>
                <input className="p-2 rounded border flex-1" value={target} onChange={e => setTarget(e.target.value)} placeholder="category or domain" />
            </div>
            <div className="mt-2 text-sm text-gray-500">Days</div>
            <div className="flex gap-1 mt-1">
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                    <button key={d} onClick={() => toggleDay(d)} className={`px-2 py-1 rounded ${days.includes(d) ? 'bg-indigo-600 text-white' : 'border'}`}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}</button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
                <input type="time" value={start} onChange={e => setStart(e.target.value)} className="p-2 rounded border" />
                <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="p-2 rounded border" />
                <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={save}>Add Schedule</button>
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
        })()
    }, [])

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
        <div className="p-6 w-full font-sans">
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-md">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">SiteFuse — Domains</h2>
                        <p className="text-sm text-gray-500">Manage tracked domains and limits</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input placeholder="Search domains" className="p-2 rounded border" value={query} onChange={(e) => setQuery(e.target.value)} />
                        <button className="px-3 py-2 rounded border text-sm" onClick={() => { setSelected({}); setQuery(''); }}>Reset</button>
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2">Category Defaults</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {knownCategories().map((c) => (
                            <CategoryDefault key={c} category={c} />
                        ))}
                    </div>
                </div>

                <ScheduleForm onAdd={async () => { const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }} />
                <ScheduleList refreshKey={Math.random()} />

                <div className="mb-4 grid grid-cols-3 gap-3 items-center">
                    <input className="col-span-2 p-2 rounded border" placeholder="domain.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
                    <div className="flex gap-2">
                        <input className="flex-1 p-2 rounded border" placeholder="minutes" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} />
                        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={addLimit}>Add</button>
                    </div>
                </div>

                <div className="mb-3 flex items-center gap-3">
                    <button className="px-3 py-2 rounded bg-indigo-500 text-white" onClick={() => batchSetLimit(15)}>Set 15m for selected</button>
                    <button className="px-3 py-2 rounded bg-indigo-500 text-white" onClick={() => batchSetLimit(30)}>Set 30m for selected</button>
                </div>

                <div className="overflow-auto max-h-[60vh]">
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
                                    <td className="py-2 align-top">{d}</td>
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
