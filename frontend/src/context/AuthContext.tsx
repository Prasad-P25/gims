import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, LoginResponse } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Optionally verify token by fetching profile
          // const profile = await authService.getProfile();
          // setUser(profile);
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const response: LoginResponse = await authService.login(phone, password);

    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.user));

    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
