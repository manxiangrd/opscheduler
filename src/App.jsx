import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Outlets from './pages/Outlets';
import Deployments from './pages/Deployments';
import Leaves from './pages/Leaves';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import UserManagement from './pages/UserManagement';

// Guard: redirect to /login if not authenticated
const RequireAuth = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Guard: redirect admins away from login if already signed in
const RequireGuest = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

// Guard: admin-only pages
const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
};

const AuthenticatedApp = () => (
  <Routes>
    <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
    <Route element={<RequireAuth><Layout /></RequireAuth>}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/outlets" element={<Outlets />} />
      <Route path="/deployments" element={<Deployments />} />
      <Route path="/leaves" element={<Leaves />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/audit" element={<AuditLog />} />
      <Route path="/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
