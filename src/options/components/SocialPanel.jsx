import React from 'react'
import { motion } from 'framer-motion'

export default function SocialPanel({ socialList, socialCatLimit, setSocialCatLimit, onSave, onBlock, onSuggest }) {
    return (
        <div className="max-h-[60vh] overflow-auto pr-2 space-y-4">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-2 -mx-2">
                <div className="flex items-center gap-2">
                    <input className="sf-input w-40" value={socialCatLimit} onChange={(e) => setSocialCatLimit(e.target.value)} placeholder="Social category minutes" />
                    <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={onSave}>Save</button>
                    <div className="text-sm text-gray-500 ml-auto">Quick actions for social domains</div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {socialList.length === 0 && <div className="text-sm text-gray-500">No social domains tracked yet.</div>}
                {socialList.map(s => (
                    <motion.div key={s.domain} whileHover={{ y: -3 }} className={`p-4 rounded-lg border ${s.avg >= 30 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-white dark:bg-gray-800'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium">{s.domain}</div>
                                <div className="text-xs text-gray-500">Last 7 days: <strong>{s.minutes}m</strong> — Avg/day: <strong>{s.avg}m</strong></div>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 rounded border" onClick={() => onBlock(s.domain)}>Block</button>
                                <button className="px-3 py-1 rounded" onClick={() => onSuggest(s.domain)}>Suggest Block</button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
