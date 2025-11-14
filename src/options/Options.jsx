import React, { useEffect, useState, useMemo, useRef } from 'react'
import { getAll, setLimit, removeLimit, blockDomain, unblockDomain, getUsageLast7Days, getStorage, setStorage, getSchedules, addSchedule, removeSchedule, getWhitelist, addWhitelist, removeWhitelist, getCategoriesList, addCategory, removeCategory, assignDomainToCategory, getDomainsForCategory } from '../utils/storage'
import { knownCategories, defaultLimitForCategory, categorizeDomain } from '../utils/categories'
import '../styles/tailwind.css'
import { motion, AnimatePresence } from 'framer-motion'
import { TrashIcon, BellAlertIcon, ArrowLeftIcon, CogIcon, ChartBarIcon, ShieldCheckIcon, TagIcon, PlusIcon, XMarkIcon, CheckIcon, ClockIcon } from '@heroicons/react/24/outline'

function formatUsage(s) {
    if (!s) return '0m 0s'
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}m ${ss}s`
}

function CategoryDefault({ category }) {
    const [val, setVal] = useState('')
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        (async () => {
            const s = await getStorage(['categoryDefaults'])
            const defs = s.categoryDefaults || {}
            setVal(defs[category] || '')
        })()
    }, [category])

    async function save() {
        const mins = parseInt(val, 10)
        if (isNaN(mins)) return
        const s = await getStorage(['categoryDefaults'])
        const defs = s.categoryDefaults || {}
        defs[category] = mins
        await setStorage({ categoryDefaults: defs })
        setIsEditing(false)
    }

    return (
        <motion.div
            layout
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{category}</span>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    >
                        <CogIcon className="w-4 h-4" />
                    </button>
                ) : (
                    <div className="flex gap-1">
                        <button
                            onClick={save}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        >
                            <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {isEditing ? (
                <div className="flex gap-2">
                    <input
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder="Minutes"
                        type="number"
                    />
                </div>
            ) : (
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {val || '∞'}<span className="text-sm font-normal text-gray-500 ml-1">min</span>
                </div>
            )}
        </motion.div>
    )
}

function ScheduleForm({ onAdd }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [type, setType] = useState('category')
    const [target, setTarget] = useState('social')
    const [days, setDays] = useState([1, 2, 3, 4, 5])
    const [start, setStart] = useState('21:00')
    const [end, setEnd] = useState('07:00')

    function toggleDay(d) {
        setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : ds.concat([d]))
    }

    async function save() {
        const entry = { type, target, days, start, end, enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        await addSchedule(entry)
        onAdd && onAdd()
        setIsExpanded(false)
        // Reset form
        setType('category')
        setTarget('social')
        setDays([1, 2, 3, 4, 5])
        setStart('21:00')
        setEnd('07:00')
    }

    if (!isExpanded) {
        return (
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setIsExpanded(true)}
                className="w-full p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white flex items-center justify-center gap-3 hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
                <PlusIcon className="w-5 h-5" />
                <span className="font-semibold">Add New Schedule</span>
            </motion.button>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Schedule</h3>
                <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="category">Category</option>
                            <option value="domain">Domain</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target</label>
                        <input
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={target}
                            onChange={e => setTarget(e.target.value)}
                            placeholder="category or domain"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days</label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { value: 0, label: 'Sun' },
                            { value: 1, label: 'Mon' },
                            { value: 2, label: 'Tue' },
                            { value: 3, label: 'Wed' },
                            { value: 4, label: 'Thu' },
                            { value: 5, label: 'Fri' },
                            { value: 6, label: 'Sat' }
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => toggleDay(value)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${days.includes(value)
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                        <input
                            type="time"
                            value={start}
                            onChange={e => setStart(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Time</label>
                        <input
                            type="time"
                            value={end}
                            onChange={e => setEnd(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={save}
                            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                        >
                            Add Schedule
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function ScheduleList({ refreshKey }) {
    const [schedules, setSchedules] = useState([])

    useEffect(() => {
        (async () => {
            const s = await getSchedules()
            setSchedules(s)
        })()
    }, [refreshKey])

    return (
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Schedules</h3>
            <div className="space-y-3">
                {schedules.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No schedules configured yet.</p>
                    </div>
                )}
                <AnimatePresence>
                    {schedules.map(s => (
                        <motion.div
                            key={s.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between hover:shadow-md transition-shadow duration-200"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${s.type === 'category'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>
                                        {s.type}
                                    </span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{s.target}</span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {s.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')} • {s.start} — {s.end}
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    await removeSchedule(s.id);
                                    setSchedules(await getSchedules())
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}

export default function Options() {
    const [data, setData] = useState({ limits: {}, blocked: {}, usage: {} })
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState({})
    const [domainInput, setDomainInput] = useState('')
    const [limitInput, setLimitInput] = useState('')
    const [activeTab, setActiveTab] = useState('domains')
    const [socialList, setSocialList] = useState([])
    const [socialCatLimit, setSocialCatLimit] = useState('')
    const [whitelist, setWhitelist] = useState([])
    const [whitelistInput, setWhitelistInput] = useState('')
    const [categoriesCustom, setCategoriesCustom] = useState([])
    const [newCategoryName, setNewCategoryName] = useState('')
    const [selectedCategory, setSelectedCategory] = useState(null)
    const [categoryDomains, setCategoryDomains] = useState([])
    const [assignDomainInput, setAssignDomainInput] = useState('')
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const tabs = [
        { id: 'domains', name: 'Domains', icon: ChartBarIcon },
        { id: 'social', name: 'Social', icon: BellAlertIcon },
        { id: 'whitelist', name: 'Whitelist', icon: ShieldCheckIcon },
        { id: 'categories', name: 'Categories', icon: TagIcon },
    ]

    useEffect(() => {
        (async () => {
            const all = await getAll()
            setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })

            const s = await getStorage(['categoryDefaults'])
            if (!s.categoryDefaults) {
                const defs = {}
                for (const c of knownCategories()) defs[c] = defaultLimitForCategory(c)
                await setStorage({ categoryDefaults: defs })
            }

            try {
                const t = (await getStorage(['theme'])).theme || 'auto'
                const sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
                const isDark = t === 'dark' || (t === 'auto' && sys && sys.matches)
                document.documentElement.classList.toggle('dark', isDark)
            } catch (e) { }
        })()
    }, [])

    useEffect(() => {
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
    }, [])

    useEffect(() => {
        (async () => {
            try {
                const all = await getAll()
                const keys = new Set([...(Object.keys(all.limits || {})), ...(Object.keys(all.blocked || {})), ...(Object.keys(all.usage || {}))])
                const socials = []
                for (const d of Array.from(keys)) {
                    if (categorizeDomain(d) === 'social') {
                        const last7 = await getUsageLast7Days(d).catch(() => [])
                        const minutes = last7.reduce((a, b) => a + b, 0)
                        const avg = Math.round((minutes / 7) || 0)
                        socials.push({ domain: d, minutes, avg })
                    }
                }
                setSocialList(socials.sort((a, b) => b.minutes - a.minutes))
            } catch (e) { }
            try {
                const s = await getStorage(['categoryDefaults'])
                setSocialCatLimit((s.categoryDefaults && s.categoryDefaults.social) || '')
            } catch (e) { }
        })()
    }, [data])

    useEffect(() => {
        (async () => {
            try {
                const wl = await getWhitelist()
                setWhitelist(wl)
            } catch (e) { }
            try {
                const cls = await getCategoriesList()
                setCategoriesCustom(cls || [])
            } catch (e) { }
        })()
    }, [data])

    useEffect(() => {
        (async () => {
            if (!selectedCategory) return setCategoryDomains([])
            try {
                const doms = await getDomainsForCategory(selectedCategory)
                setCategoryDomains(doms)
            } catch (e) { setCategoryDomains([]) }
        })()
    }, [selectedCategory, data])

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => { try { window.location.href = '/popup.html' } catch (e) { try { window.history.back() } catch (ee) { } } }}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                            >
                                <ArrowLeftIcon className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">SiteFuse</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Advanced Domain Management</p>
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <div className="w-5 h-5 flex flex-col justify-between">
                                <span className={`w-full h-0.5 bg-current transform transition-all duration-200 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                                <span className={`w-full h-0.5 bg-current transition-all duration-200 ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`}></span>
                                <span className={`w-full h-0.5 bg-current transform transition-all duration-200 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                            </div>
                        </button>

                        {/* Desktop Navigation */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${activeTab === tab.id
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.name}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Mobile Navigation */}
                    <AnimatePresence>
                        {isMobileMenuOpen && (
                            <motion.nav
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-4"
                            >
                                <div className="space-y-2">
                                    {tabs.map((tab) => {
                                        const Icon = tab.icon
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab(tab.id)
                                                    setIsMobileMenuOpen(false)
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === tab.id
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                                {tab.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </motion.nav>
                        )}
                    </AnimatePresence>
                </div>
            </motion.header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="space-y-6">
                            {/* Quick Actions */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => batchSetLimit(15)}
                                        className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors duration-200 text-left"
                                    >
                                        Set 15m for selected
                                    </button>
                                    <button
                                        onClick={() => batchSetLimit(30)}
                                        className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors duration-200 text-left"
                                    >
                                        Set 30m for selected
                                    </button>
                                </div>
                            </div>

                            {/* Category Defaults */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Defaults</h3>
                                <div className="space-y-4">
                                    {knownCategories().map((c) => (
                                        <CategoryDefault key={c} category={c} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-3">
                        <div className="space-y-6">
                            {/* Search and Add Domain */}
                            {activeTab === 'domains' && (
                                <>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                <input
                                                    placeholder="Search domains..."
                                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    value={query}
                                                    onChange={(e) => setQuery(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    placeholder="domain.com"
                                                    value={domainInput}
                                                    onChange={(e) => setDomainInput(e.target.value)}
                                                />
                                                <input
                                                    className="w-20 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    placeholder="min"
                                                    value={limitInput}
                                                    onChange={(e) => setLimitInput(e.target.value)}
                                                    type="number"
                                                />
                                                <button
                                                    onClick={addLimit}
                                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Domains Table */}
                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                                    <tr>
                                                        <th className="w-12 px-4 py-4"></th>
                                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Domain</th>
                                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage</th>
                                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit</th>
                                                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    {domains.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                                                No domains tracked yet. Add your first domain to get started.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        domains.map((d) => (
                                                            <motion.tr
                                                                key={d}
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                                            >
                                                                <td className="px-4 py-4">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!selected[d]}
                                                                        onChange={(e) => setSelected(s => ({ ...s, [d]: e.target.checked }))}
                                                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{d}</td>
                                                                <td className="px-4 py-4">
                                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${(data.usage[d] || 0) > (data.limits[d] || 0) * 60
                                                                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                        }`}>
                                                                        {formatUsage(data.usage[d])}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                                        {data.limits[d] ? `${data.limits[d]} min` : '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => remove(d)}
                                                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                                                                            title="Remove limit"
                                                                        >
                                                                            <TrashIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => toggleBlocked(d)}
                                                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 ${data.blocked[d]
                                                                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                                                                : 'bg-red-600 hover:bg-red-700 text-white'
                                                                                }`}
                                                                        >
                                                                            {data.blocked[d] ? 'Unblock' : 'Block'}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Schedules Section */}
                            <div className="space-y-6">
                                <ScheduleForm onAdd={async () => { const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} }) }} />
                                <ScheduleList refreshKey={Math.random()} />
                            </div>

                            {/* Social Media Tab */}
                            {activeTab === 'social' && (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Social Media Management</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Category-wide Limit (minutes)
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                        value={socialCatLimit}
                                                        onChange={(e) => setSocialCatLimit(e.target.value)}
                                                        placeholder="e.g. 30"
                                                        type="number"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const mins = parseInt(socialCatLimit, 10)
                                                            if (isNaN(mins)) return
                                                            const s = await getStorage(['categoryDefaults'])
                                                            const defs = s.categoryDefaults || {}
                                                            defs.social = mins
                                                            await setStorage({ categoryDefaults: defs })
                                                            const all = await getAll(); setData({ limits: all.limits || {}, blocked: all.blocked || {}, usage: all.usage || {} })
                                                        }}
                                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="p-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tracked Social Domains</h4>
                                            <div className="space-y-4">
                                                {socialList.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                        No social domains tracked yet.
                                                    </div>
                                                ) : (
                                                    socialList.map((s) => (
                                                        <motion.div
                                                            key={s.domain}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                                        >
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900 dark:text-white">{s.domain}</div>
                                                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                                    Last 7 days: <strong>{s.minutes}m</strong> • Avg/day: <strong>{s.avg}m</strong>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => blockDomain(s.domain)}
                                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                                                                >
                                                                    Block
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}