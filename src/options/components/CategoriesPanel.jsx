import React, { useState, useEffect } from 'react'
import { CategoryCard } from './UI'
import { getDomainsForCategory, assignDomainToCategory } from '../../utils/storage'

export default function CategoriesPanel({ knownCategoriesList, categoriesCustom, newCategoryName, setNewCategoryName, onCreateCategory, refreshData }) {
    const allCats = [...knownCategoriesList, ...categoriesCustom.map(c => c.name)]
    const [assignInputs, setAssignInputs] = useState({})
    const [domainsMap, setDomainsMap] = useState({})

    useEffect(() => {
        let mounted = true
            ; (async () => {
                const out = {}
                for (const cn of allCats) {
                    try {
                        const ds = await getDomainsForCategory(cn)
                        out[cn] = ds || []
                    } catch (e) {
                        out[cn] = []
                    }
                }
                if (mounted) setDomainsMap(out)
            })()
        return () => { mounted = false }
    }, [allCats.join('|'), categoriesCustom.length])

    async function handleAssign(cat) {
        const domain = (assignInputs[cat] || '').trim()
        if (!domain) return
        await assignDomainToCategory(domain, cat)
        // refresh local map and parent data
        try {
            const ds = await getDomainsForCategory(cat)
            setDomainsMap(m => ({ ...m, [cat]: ds || [] }))
        } catch (e) { }
        setAssignInputs(s => ({ ...s, [cat]: '' }))
        refreshData && refreshData()
    }

    return (
        <div className="max-h-[60vh] overflow-auto pr-2 space-y-4">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-2 -mx-2">
                <div className="flex gap-2 items-center">
                    <input className="sf-input flex-1" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                    <button className="px-3 py-2 rounded bg-indigo-600 text-white" onClick={onCreateCategory}>Create</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allCats.map(cn => (
                    <CategoryCard key={cn} name={cn} domains={domainsMap[cn] || []} assignInput={assignInputs[cn] || ''} setAssignInput={(v) => setAssignInputs(s => ({ ...s, [cn]: v }))} onAssign={() => handleAssign(cn)} />
                ))}
            </div>
        </div>
    )
}
