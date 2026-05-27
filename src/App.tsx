import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'
import { Dashboard } from '@/pages/Dashboard'
import { Campaigns } from '@/pages/Campaigns'
import { CampaignBuilder } from '@/pages/CampaignBuilder'
import { GenerationQueue } from '@/pages/GenerationQueue'
import { Analytics } from '@/pages/Analytics'
import { Settings } from '@/pages/Settings'
import { CampaignDetail } from '@/pages/CampaignDetail'
import { Login } from '@/pages/Login'
import { Landing } from '@/pages/Landing'
import { Signup } from '@/pages/Signup'
import { Admin } from '@/pages/Admin'
import { Developers } from '@/pages/Developers'
import { Contacts } from '@/pages/Contacts'
import { useThemeStore } from '@/store/themeStore'
import { ToastContainer } from '@/components/ToastContainer'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/campaigns/new" element={<CampaignBuilder />} />
                <Route path="/campaigns/:id" element={<CampaignDetail />} />
                <Route path="/campaigns/:id/queue" element={<GenerationQueue />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/developers" element={<Developers />} />
                <Route path="/contacts" element={<Contacts />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default function App() {
  const { isDark } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return (
    <AuthProvider>
      <AppRoutes />
      <ToastContainer />
    </AuthProvider>
  )
}
