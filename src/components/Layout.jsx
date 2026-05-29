import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/db';
import {
  LayoutDashboard, Users, Building2, CalendarDays, FileText,
  Bell, BarChart3, Shield, LogOut, Menu, X, ChevronRight, UserCog
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/outlets', label: 'Outlets', icon: Building2 },
  { path: '/deployments', label: 'Deployments', icon: CalendarDays },
  { path: '/leaves', label: 'Leaves', icon: FileText },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/audit', label: 'Audit Log', icon: Shield },
];

// Admin-only nav items
const adminNavItems = [
  { path: '/users', label: 'User Management', icon: UserCog },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    db.entities.Alert.filter({ status: 'New' })
      .then(alerts => setUnreadAlerts(alerts.length))
      .catch(() => {});
  }, []);

  const { logout: authLogout } = useAuth();
  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon size={18} />
        <span className="flex-1">{item.label}</span>
        {item.label === 'Alerts' && unreadAlerts > 0 && (
          <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">{unreadAlerts}</Badge>
        )}
        {isActive && <ChevronRight size={14} />}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <CalendarDays size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">OpScheduler</p>
            <p className="text-xs text-slate-500">Operations Dashboard</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.path} item={item} />)}
        {user?.role === 'admin' && (
          <>
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin</p>
            </div>
            {adminNavItems.map(item => <NavLink key={item.path} item={item} />)}
          </>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-slate-200">
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
              {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200 fixed inset-y-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-500">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600">
            <Menu size={22} />
          </button>
          <span className="font-bold text-slate-900">OpScheduler</span>
          <div className="ml-auto relative">
            <Bell size={20} className="text-slate-600" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">{unreadAlerts}</span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
