import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import Dashboard from '../../pages/dashboard/Dashboard'
import Integrations from '../../pages/integrations/Integrations'
import Executions from '../../pages/executions/Executions'
import Errors from '../../pages/errors/Errors'
import Settings from '../../pages/settings/Settings'
import LoginPage from '../../pages/auth/LoginPage'

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="integrations" element={<Integrations />} />
      <Route path="executions" element={<Executions />} />
      <Route path="errors" element={<Errors />} />
      <Route path="settings" element={<Settings />} />
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
)

export default AppRoutes
