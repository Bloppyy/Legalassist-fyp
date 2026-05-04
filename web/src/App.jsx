import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/Cases/Detail';
import Documents from './pages/Documents';
import DocumentDetail from './pages/Documents/Detail';
import Templates from './pages/Templates';
import Deadlines from './pages/Deadlines';
import Contacts from './pages/Contacts';
import Guidelines from './pages/Guidelines';
import Notifications from './pages/Notifications';
import Users from './pages/Users';

const ALL_ROLES = ['intern', 'associate', 'partner', 'admin'];

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Cases /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cases/:id"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><CaseDetail /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Documents /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents/:id"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><DocumentDetail /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/templates"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Templates /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/deadlines"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Deadlines /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contacts"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Contacts /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/guidelines"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Guidelines /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute roles={ALL_ROLES}>
            <Layout><Notifications /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <Layout><Users /></Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
