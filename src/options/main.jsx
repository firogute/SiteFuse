import React from 'react'
import { createRoot } from 'react-dom/client'
import Options from './Options'

const el = document.getElementById('root')
if (el) {
    const root = createRoot(el)
    root.render(<Options />)
}
