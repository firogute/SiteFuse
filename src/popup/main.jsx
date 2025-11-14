import React from 'react'
import { createRoot } from 'react-dom/client'
import Popup from './Popup'

const el = document.getElementById('root')
if (el) {
    const root = createRoot(el)
    root.render(<Popup />)
}
