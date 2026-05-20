import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import Dashboard from '../../pages/dashboard/Dashboard'
import Integrations from '../../pages/integrations/Integrations'
import Executions from '../../pages/executions/Executions'
import Errors from '../../pages/errors/Errors'
import Settings from '../../pages/settings/Settings'

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="integrations" element={<Integrations />} />
      <Route path="executions" element={<Executions />} />
      <Route path="errors" element={<Errors />} />
      <Route path="settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
)

export default AppRoutes
