import React from 'react'
import { createRoot } from 'react-dom/client'
import Blocked from './Blocked'

const el = document.getElementById('root')
if (el) {
    const root = createRoot(el)
    root.render(<Blocked />)
}
