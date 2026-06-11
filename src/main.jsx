import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import ManagerPage from './pages/ManagerPage.jsx'
import StaffPage from './pages/StaffPage.jsx'
import SupervisorPage from './pages/SupervisorPage.jsx'
import { initSeedData } from './storage/seedData.js'
import './styles.css'

initSeedData()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/supervisor" element={<SupervisorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
