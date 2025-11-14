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
    const [graceUntil, setGraceUntil] = useState(null)

    useEffect(() => {
        (async () => {
            try {
                // Prefer query params provided by background redirect: ?fromTab=ID&domain=...
                const params = new URLSearchParams(window.location.search)
                const fromTab = params.get('fromTab')
                const qDomain = params.get('domain')
                const d = qDomain || (document.referrer ? new URL(document.referrer).hostname : null)
                setDomain(d)
                const s = await getStorage(['blocked', 'grace', '_legacy_grace'])
                const b = (s.blocked && s.blocked[d]) || null
                if (b && b.until) setUnlockAt(b.until)
                try {
                    let gu = null
                    if (fromTab) {
                        const g = s.grace || {}
                        const entry = g[String(fromTab)]
                        gu = entry && entry.until ? entry.until : null
                    } else {
                        // fallback: check legacy domain-keyed grace stored under _legacy_grace
                        const legacy = s._legacy_grace || {}
                        gu = legacy[d] || null
                    }
                    setGraceUntil(gu)
                } catch (e) { }
                // apply theme from storage (supports 'auto')
                try {
                    const t = (await getStorage(['theme'])).theme || 'auto'
                    const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
                    const isDark = t === 'dark' || (t === 'auto' && sys && sys.matches)
                    document.documentElement.classList.toggle('dark', isDark)
                } catch (e) { }
            } catch (e) {
                setDomain(null)
            }
        })()

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

        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])

    const msLeft = unlockAt ? Math.max(0, unlockAt - now) : null
    const msGraceLeft = graceUntil ? Math.max(0, graceUntil - now) : null

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card max-w-md w-full flex flex-col items-center gap-4 text-center" role="main" aria-labelledby="blocked-heading">
                <div className="text-red-600">
                    <ExclamationTriangleIcon className="h-20 w-20" />
                </div>
                <h1 id="blocked-heading" className="text-2xl font-bold">This site is blocked</h1>
                <p className="text-gray-600 dark:text-gray-300">The site has exceeded its allowed usage time or was blocked by SiteFuse.</p>
                {msLeft !== null ? (
                    <div>
                        <div className="text-sm text-gray-500">Temporary block ends in</div>
                        <div className="text-xl font-semibold" aria-live="polite">{formatCountdown(msLeft)}</div>
                    </div>
                ) : null}

                {msGraceLeft !== null && msGraceLeft > 0 ? (
                    <div className="w-full">
                        <div className="text-sm text-yellow-600">Grace period: this tab will close</div>
                        <div className="text-xl font-semibold text-yellow-700" aria-live="polite">{formatCountdown(msGraceLeft)}</div>
                    </div>
                ) : null}

                <div className="w-full flex flex-col sm:flex-row justify-center gap-3">
                    <a className="flex-1 text-center px-4 py-2 rounded bg-indigo-600 text-white btn-no-outline" href="/options.html">Open Settings</a>
                    <button className="flex-1 text-center px-4 py-2 rounded border btn-no-outline" onClick={() => { try { window.history.back() } catch (e) { window.location.href = '/popup.html' } }}>Go Back</button>
                </div>
            </motion.div>
        </div>
    )
}
