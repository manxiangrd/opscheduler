import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { seedIfEmpty } from '@/lib/seed'

// Load seed data on first run (no-op if already seeded)
seedIfEmpty();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
