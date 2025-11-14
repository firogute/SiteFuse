import React, { useEffect, useState } from 'react'
import { getBadges } from '../utils/storage'

export default function Badges() {
    const [badges, setBadges] = useState({})
    useEffect(() => {
        (async () => setBadges(await getBadges()))()
    }, [])

    const keys = Object.keys(badges)
    if (keys.length === 0) return <div className="text-sm text-gray-500">No badges yet</div>

    return (
        <div className="flex gap-2 items-center" role="list">
            {keys.map(k => (
                <div key={k} role="listitem" className="p-2 bg-yellow-100 rounded shadow-sm text-xs">
                    <div className="font-semibold">{k}</div>
                    <div className="text-xs text-gray-500">{new Date(badges[k].awardedAt).toLocaleDateString()}</div>
                </div>
            ))}
        </div>
    )
}
