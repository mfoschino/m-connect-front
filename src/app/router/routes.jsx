import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../../layouts/MainLayout'
import Dashboard from '../../pages/dashboard/Dashboard'
import Integrations from '../../pages/integrations/Integrations'
import Executions from '../../pages/executions/Executions'
import ExecutionDetail from '../../pages/executions/ExecutionDetail'
import Errors from '../../pages/errors/Errors'
import Settings from '../../pages/settings/Settings'
import UserAdminPage from '../../pages/users/UserAdminPage'
import ProfilePage from '../../pages/profile/ProfilePage'
import LoginPage from '../../pages/auth/LoginPage'
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage'
import ForgotPasswordSentPage from '../../pages/auth/ForgotPasswordSentPage'
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage'
import ProtectedRoute from '../../components/common/ProtectedRoute'

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/forgot-password-sent" element={<ForgotPasswordSentPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/" element={<MainLayout />}>
      <Route
        index
        element={
          <ProtectedRoute>
            <Navigate to="/dashboard" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="integrations"
        element={
          <ProtectedRoute>
            <Integrations />
          </ProtectedRoute>
        }
      />
      <Route
        path="executions"
        element={
          <ProtectedRoute>
            <Executions />
          </ProtectedRoute>
        }
      />
      <Route
        path="executions/:traceId"
        element={
          <ProtectedRoute>
            <ExecutionDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="errors"
        element={
          <ProtectedRoute>
            <Errors />
          </ProtectedRoute>
        }
      />
      <Route
        path="profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="settings/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserAdminPage />
          </ProtectedRoute>
        }
      />
    </Route>
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
)

export default AppRoutes
