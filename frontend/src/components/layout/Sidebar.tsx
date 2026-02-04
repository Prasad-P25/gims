import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  Users,
  UsersRound,
  History,
  LogOut,
  BarChart3,
  UserCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ClipboardList },
  { name: 'Reports', href: '/reports', icon: FileText },
];

// For admin only
const adminOnlyNavigation = [
  { name: 'My Team', href: '/team-dashboard', icon: BarChart3 },
];

// For admin and super_admin
const adminNavigation = [
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Only for super_admin
const superAdminNavigation = [
  { name: 'Teams', href: '/teams', icon: UsersRound },
  { name: 'Activity Log', href: '/audit', icon: History },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo - White Section */}
          <div className="flex items-center justify-center h-20 px-3 bg-white">
            <img
              src="/logo.png"
              alt="GURUAMRUT Infrastructure and Management Services"
              className="h-16 w-auto object-contain"
              onError={(e) => {
                // Fallback if logo doesn't load
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Blue Section - Navigation & User */}
          <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              <div className="mb-4">
                <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Main Menu
                </p>
              </div>

              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    )
                  }
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}

              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <>
                  <div className="pt-4 mt-4 border-t border-slate-700">
                    <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Management
                    </p>
                  </div>
                  {/* Admin Only - Team Dashboard */}
                  {user?.role === 'admin' && adminOnlyNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                          isActive
                            ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        )
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                  {adminNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                          isActive
                            ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        )
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                  {user?.role === 'super_admin' && superAdminNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                          isActive
                            ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        )
                      }
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>

            {/* User info & logout */}
            <div className="border-t border-slate-700 p-4">
              <div className="flex items-center mb-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-blue to-brand-green flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-white">{user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
              </div>
              <NavLink
                to="/profile"
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors mb-1',
                    isActive
                      ? 'bg-brand-blue text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )
                }
              >
                <UserCircle className="mr-3 h-5 w-5" />
                Profile
              </NavLink>
              <button
                onClick={logout}
                className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
