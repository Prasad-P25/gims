import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left side */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          {title && (
            <h1 className="ml-4 text-xl font-semibold text-gray-900 lg:ml-0">
              {title}
            </h1>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          {/* User avatar (desktop) */}
          <div className="hidden sm:flex items-center">
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-600 font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="ml-2 text-sm font-medium text-gray-700">
              {user?.name}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
