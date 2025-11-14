import React from 'react'
import { motion } from 'framer-motion'
import { TrashIcon } from '@heroicons/react/24/outline'

export const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))

export function UsageBar({ value, label }) {
    const pct = clamp(value || 0)
    const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-indigo-500'
    return (
        <div className="w-full">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <div>{label}</div>
                <div className="font-semibold">{pct}%</div>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-2 ${color}`} />
            </div>
        </div>
    )
}

export function DomainCard({ d, data, selected, onSelect, onRemove, onToggleBlocked, onSetLimit, onSuggestBlock, onOpenDetail }) {
    const usage = data.usage[d] || 0
    const limit = data.limits[d] || 0
    const pct = limit ? clamp(Math.round((usage / limit) * 100)) : 0
    return (
        <motion.div whileHover={{ y: -3 }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card card-elevate p-4 bg-white dark:bg-gray-800 border rounded-lg flex flex-col">
            <div className="flex items-start gap-3">
                <input aria-label={`Select ${d}`} type="checkbox" checked={!!selected} onChange={e => onSelect(d, e.target.checked)} className="mt-1" />
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-medium break-words">{d}</div>
                        <div className="text-sm text-gray-500">{limit ? `${limit}m` : '—'}</div>
                    </div>
                    <div className="mt-2">
                        <UsageBar value={pct} label={`${usage}m used`} />
                    </div>
                </div>
            </div>
            <div className="mt-3 flex gap-2 items-center">
                <motion.button whileTap={{ scale: 0.97 }} className="px-3 py-1 rounded border text-sm" onClick={() => onRemove(d)}><TrashIcon className="w-4 h-4 inline-block mr-1" /> Remove</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} className={`px-3 py-1 rounded text-sm ${data.blocked[d] ? 'bg-yellow-500 text-white' : 'bg-red-600 text-white'}`} onClick={() => onToggleBlocked(d)}>{data.blocked[d] ? 'Unblock' : 'Block'}</motion.button>
                <div className="ml-auto flex items-center gap-2">
                    <motion.button whileTap={{ scale: 0.97 }} className="px-2 py-1 rounded bg-indigo-600 text-white text-sm" onClick={() => onSetLimit(d, Math.max(1, Math.round((limit || 0))))}>Set Limit</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} className="px-2 py-1 rounded border text-sm" onClick={() => onSuggestBlock(d)}>Suggest</motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} className="px-2 py-1 rounded text-sm border" onClick={() => onOpenDetail && onOpenDetail(d)}>Details</motion.button>
                </div>
            </div>
        </motion.div>
    )
}

export function CategoryCard({ name, domains = [], onAssign, assignInput, setAssignInput }) {
    return (
        <div className="card card-elevate p-4 bg-white dark:bg-gray-800 border rounded-lg">
            <div className="flex items-center justify-between">
                <div className="font-medium">{name}</div>
                <div className="text-xs muted-small">{name === 'social' ? 'category' : ''}</div>
            </div>
            <div className="mt-3 text-xs muted-small">Assign domains to this category or view assigned domains.</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input className="sf-input flex-1" placeholder="domain.com" value={assignInput} onChange={e => setAssignInput(e.target.value)} />
                <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={onAssign}>Assign</button>
            </div>
            <div className="mt-3">
                <div className="text-sm font-semibold">Assigned domains</div>
                <div className="mt-2 space-y-2">
                    {domains.length === 0 && <div className="text-sm text-gray-500">No domains assigned.</div>}
                    {domains.map(d => (
                        <div key={d.domain} className="p-2 border rounded flex items-center justify-between">
                            <div>{d.domain}</div>
                            <div className="text-xs muted-small">{d.usage ? `${d.usage}m` : '—'}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function CategoryDefault({ category, val, setVal, onSave }) {
    return (
        <div className="p-2 border rounded card-elevate">
            <div className="text-xs muted-small">{category}</div>
            <div className="mt-2 flex gap-2">
                <input className="sf-input flex-1 text-sm" value={val} onChange={(e) => setVal(e.target.value)} />
                <button className="px-2 py-1 rounded sf-btn-primary text-sm" onClick={onSave}>Save</button>
            </div>
        </div>
    )
}

export function DomainDetail({ domain, data, onClose, onRemove, onToggleBlocked, onSetLimit }) {
    if (!domain) return null
    const usage = data.usage[domain] || 0
    const limit = data.limits[domain] || 0
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">{domain}</h3>
                        <div className="text-sm text-gray-500">Usage: {usage}m — Limit: {limit ? `${limit}m` : '—'}</div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 rounded border" onClick={onClose}>Close</button>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <UsageBar value={limit ? clamp(Math.round((usage / limit) * 100)) : 0} label={`${usage}m used`} />
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={async () => { const mins = prompt('Set minutes for ' + domain, (limit || 15)); const m = parseInt(mins, 10); if (!isNaN(m)) { await onSetLimit(domain, m) } }}>Set Limit</button>
                        <button className="px-3 py-2 rounded border" onClick={() => onToggleBlocked(domain)}>{data.blocked[domain] ? 'Unblock' : 'Block'}</button>
                        <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={() => onRemove(domain)}>Remove</button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
