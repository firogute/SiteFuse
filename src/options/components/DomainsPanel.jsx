import React from 'react'
import { DomainCard } from './UI'

export default function DomainsPanel({
    domains, data, selected, setSelected, domainInput, setDomainInput, limitInput, setLimitInput, addLimit,
    remove, toggleBlocked, setLimitHandler, suggestBlockHandler, onOpenDetail, bulkSetLimit
}) {
    return (
        <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-2 -mx-2">
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <div className="flex-1 w-full">
                        <input className="sf-input w-full" placeholder="domain.com" value={domainInput} onChange={(e) => setDomainInput(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <input className="sf-input w-28" placeholder="minutes" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} />
                        <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={addLimit}>Add</button>
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <label className="text-sm text-gray-500">Quick set:</label>
                    <select className="sf-input w-28" onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && typeof window !== 'undefined') { /* parent should provide bulkSetLimit */ if (typeof bulkSetLimit === 'function') bulkSetLimit(v) } }}>
                        <option value="">—</option>
                        <option value="5">5m</option>
                        <option value="15">15m</option>
                        <option value="30">30m</option>
                        <option value="60">60m</option>
                    </select>
                    <div className="text-xs text-gray-400 ml-2">Select domains to apply</div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {domains.length === 0 && <div className="text-sm text-gray-500">No domains tracked yet.</div>}
                {domains.map(d => (
                    <DomainCard key={d} d={d} data={data} selected={!!selected[d]} onSelect={(dom, val) => setSelected(s => ({ ...s, [dom]: val }))} onRemove={remove} onToggleBlocked={toggleBlocked} onSetLimit={setLimitHandler} onSuggestBlock={suggestBlockHandler} onOpenDetail={onOpenDetail} />
                ))}
            </div>
        </div>
    )
}
