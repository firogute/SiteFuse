import React from 'react'
import { motion } from 'framer-motion'
import { TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

export const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v))

export function formatTimeSeconds(s) {
    const sec = Math.max(0, Math.floor(s || 0))
    const hh = Math.floor(sec / 3600)
    const mm = Math.floor((sec % 3600) / 60)
    const ss = sec % 60
    const hhP = hh.toString().padStart(2, '0')
    const mmP = mm.toString().padStart(2, '0')
    const ssP = ss.toString().padStart(2, '0')
    return `${hhP}:${mmP}:${ssP}`
}

export function UsageBar({ value, label }) {
    const pct = clamp(value || 0)
    const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-orange-400' : 'bg-indigo-500'
    return (
        <div className="w-full">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <div className="font-medium">{label}</div>
                <div className="font-semibold text-gray-900 dark:text-white">{pct}%</div>
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

export function DomainCard({ d, data, selected, onSelect, onRemove, onToggleBlocked, onSetLimit, onSuggestBlock, onOpenDetail }) {
    // usage stored in seconds
    const usageSeconds = data.usage[d] || 0
    const limit = data.limits[d] || 0
    const pct = limit ? clamp(Math.round((usageSeconds / (limit * 60)) * 100)) : 0

    return (
        <motion.div
            whileHover={{ y: -4, shadow: 'lg' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-md transition-all duration-200"
        >
            <div className="flex items-start gap-3 mb-3">
                <input
                    aria-label={`Select ${d}`}
                    type="checkbox"
                    checked={!!selected}
                    onChange={e => onSelect(d, e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{d}</div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {limit ? `${limit}m` : 'No limit'}
                        </div>
                    </div>
                    <UsageBar value={pct} label={`${formatTimeSeconds(usageSeconds)} used`} />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                    onClick={async () => { try { await onRemove(d) } catch (e) { console.error('remove failed', e) } }}
                >
                    <TrashIcon className="w-4 h-4" />
                    Remove
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${data.blocked[d]
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    onClick={() => onToggleBlocked(d)}
                >
                    {data.blocked[d] ? 'Unblock' : 'Block'}
                </motion.button>

                <div className="flex gap-2 ml-auto">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                        onClick={() => onSetLimit(d, Math.max(1, Math.round((limit || 0))))}
                    >
                        Set Limit
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => onSuggestBlock(d)}
                    >
                        Suggest
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => onOpenDetail && onOpenDetail(d)}
                    >
                        Details
                    </motion.button>
                </div>
            </div>
        </motion.div>
    )
}

export function CategoryCard({ name, domains = [], onAssign, assignInput, setAssignInput }) {
    return (
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-gray-900 dark:text-white text-lg capitalize">{name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {domains.length} domains
                </div>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Assign domains to this category or view assigned domains.
            </div>

            <div className="flex flex-col gap-2 mb-4">
                <input
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter domain (e.g., example.com)"
                    value={assignInput}
                    onChange={e => setAssignInput(e.target.value)}
                />
                <button
                    className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                    onClick={onAssign}
                >
                    Assign Domain
                </button>
            </div>

            <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Assigned Domains</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {domains.length === 0 && (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                            <Cog6ToothIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No domains assigned yet</p>
                        </div>
                    )}
                    {domains.map(d => (
                        <div key={d.domain} className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{d.domain}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-600 px-2 py-1 rounded">
                                {d.usage ? formatTimeSeconds(d.usage) : '—'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function CategoryDefault({ category, val, setVal, onSave }) {
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
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                    onClick={onSave}
                >
                    Save
                </button>
            </div>
        </div>
    )
}

export function DomainDetail({ domain, data, onClose, onRemove, onToggleBlocked, onSetLimit }) {
    if (!domain) return null

    const usageSeconds = data.usage[domain] || 0
    const usageLabel = formatTimeSeconds(usageSeconds)
    const limit = data.limits[domain] || 0
    const pct = limit ? clamp(Math.round((usageSeconds / (limit * 60)) * 100)) : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{domain}</h3>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Usage: <span className="font-semibold text-gray-900 dark:text-white">{usageLabel}</span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Limit: <span className="font-semibold text-gray-900 dark:text-white">
                                        {limit ? `${limit}m` : 'None'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            className="ml-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={onClose}
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Progress Bar */}
                    <div>
                        <UsageBar value={pct} label={`${usageLabel} used of ${limit || '∞'}m`} />
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="col-span-2 px-4 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                            onClick={async () => {
                                const mins = prompt('Set minutes for ' + domain, (limit || 15));
                                const m = parseInt(mins, 10);
                                if (!isNaN(m)) {
                                    await onSetLimit(domain, m)
                                }
                            }}
                        >
                            Set Time Limit
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className={`px-4 py-3 rounded-lg font-medium transition-colors ${data.blocked[domain]
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                            onClick={() => onToggleBlocked(domain)}
                        >
                            {data.blocked[domain] ? 'Unblock Site' : 'Block Site'}
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="px-4 py-3 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                            onClick={async () => {
                                try {
                                    await onRemove(domain)
                                } catch (e) {
                                    console.error('remove failed', e)
                                }
                            }}
                        >
                            <TrashIcon className="w-4 h-4" />
                            Remove
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}