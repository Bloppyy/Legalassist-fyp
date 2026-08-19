import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/Cases/Detail';
import Documents from './pages/Documents';
import DocumentDetail from './pages/Documents/Detail';
import Templates from './pages/Templates';
import Timeline from './pages/Timeline';
import FirmDeadlines from './pages/FirmDeadlines';
import Contacts from './pages/Contacts';
import Guidelines from './pages/Guidelines';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import ParserStats from './pages/ParserStats';
import ChecklistTemplates from './pages/ChecklistTemplates';
import Search from './pages/Search';

const ALL_ROLES = ['intern', 'associate', 'partner', 'admin'];

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Cases /></Layout></ProtectedRoute>} />
      <Route path="/cases/:id" element={<ProtectedRoute roles={ALL_ROLES}><Layout><CaseDetail /></Layout></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Documents /></Layout></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute roles={ALL_ROLES}><Layout><DocumentDetail /></Layout></ProtectedRoute>} />
      <Route path="/templates" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Templates /></Layout></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Timeline /></Layout></ProtectedRoute>} />
      <Route path="/firm-deadlines" element={<ProtectedRoute roles={ALL_ROLES}><Layout><FirmDeadlines /></Layout></ProtectedRoute>} />
      <Route path="/contacts" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Contacts /></Layout></ProtectedRoute>} />
      <Route path="/guidelines" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Guidelines /></Layout></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Notifications /></Layout></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute roles={ALL_ROLES}><Layout><Search /></Layout></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['admin']}><Layout><Users /></Layout></ProtectedRoute>} />
      <Route path="/admin/parser-stats" element={<ProtectedRoute roles={['admin']}><Layout><ParserStats /></Layout></ProtectedRoute>} />
      <Route path="/checklist-templates" element={<ProtectedRoute roles={ALL_ROLES}><Layout><ChecklistTemplates /></Layout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
