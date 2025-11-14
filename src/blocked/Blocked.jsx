import React, { useEffect, useState } from 'react'
import '../styles/tailwind.css'
import { motion } from 'framer-motion'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { getStorage } from '../utils/storage'

function formatCountdown(msLeft) {
    if (msLeft <= 0) return '0m 0s'
    const s = Math.floor(msLeft / 1000)
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
}

export default function Blocked() {
    const [domain, setDomain] = useState(null)
    const [unlockAt, setUnlockAt] = useState(null)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        (async () => {
            try {
                const ref = document.referrer
                const d = ref ? new URL(ref).hostname : null
                setDomain(d)
                const s = await getStorage(['blocked'])
                const b = (s.blocked && s.blocked[d]) || null
                if (b && b.until) setUnlockAt(b.until)
            } catch (e) {
                setDomain(null)
            }
        })()

        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])

    const msLeft = unlockAt ? Math.max(0, unlockAt - now) : null

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-lg">
                <div className="text-red-600 mb-4">
                    <ExclamationTriangleIcon className="h-20 w-20 mx-auto" />
                </div>
                <h1 className="text-2xl font-bold mb-2">This site is blocked</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-4">The site has exceeded its allowed usage time or was blocked by SiteFuse.</p>
                {msLeft !== null ? (
                    <div className="mb-4">
                        <div className="text-sm text-gray-500">Temporary block ends in</div>
                        <div className="text-xl font-semibold">{formatCountdown(msLeft)}</div>
                    </div>
                ) : null}

                <div className="flex justify-center gap-3">
                    <a className="px-4 py-2 rounded bg-indigo-600 text-white" href="options.html">Open Settings</a>
                    <button className="px-4 py-2 rounded border" onClick={() => window.history.back()}>Go Back</button>
                </div>
            </motion.div>
        </div>
    )
}
