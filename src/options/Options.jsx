import React, { useEffect, useState, useMemo } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days } from '../utils/storage'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { TrashIcon, BellAlertIcon } from '@heroicons/react/24/outline'

function formatUsage(s) {
    if (!s) return '0m 0s'
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
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
