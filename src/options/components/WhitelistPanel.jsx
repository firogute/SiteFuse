import React from 'react'

export default function WhitelistPanel({ whitelist, whitelistInput, setWhitelistInput, onAdd, onRemove }) {
    return (
        <div className="max-h-[60vh] overflow-auto pr-2 space-y-4">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-2 -mx-2">
                <div className="flex gap-2">
                    <input className="sf-input flex-1" placeholder="example.com" value={whitelistInput} onChange={(e) => setWhitelistInput(e.target.value)} />
                    <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={onAdd}>Add</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {whitelist.length === 0 && <div className="text-sm text-gray-500">No whitelist domains yet.</div>}
                {whitelist.map(w => (
                    <div key={w} className="p-4 rounded-lg border-l-4 border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 flex items-center justify-between">
                        <div className="font-medium">{w}</div>
                        <div>
                            <button className="px-3 py-1 rounded border text-sm" onClick={() => onRemove(w)}>Remove</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
