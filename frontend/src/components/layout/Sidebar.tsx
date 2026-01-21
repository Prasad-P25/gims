import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Bell,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ClipboardList },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Reminders', href: '/reminders', icon: Bell },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
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
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <span className="text-2xl mr-2">🏛️</span>
            <div>
              <h1 className="text-xl font-bold text-primary-600">GIMS</h1>
              <p className="text-xs text-gray-500">Task Registry</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <div className="mb-4">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            ))}

            {user?.role === 'admin' && (
              <>
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                {adminNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
