import React, { createContext, useState, useContext, useEffect } from 'react';
import { getCurrentUser, setCurrentUser } from '@/lib/db';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const stored = getCurrentUser();
    setUser(stored);
    setIsLoadingAuth(false);
  }, []);

  const login = (userObj) => {
    setCurrentUser(userObj);
    const { password_hash, ...safeUser } = userObj;
    setUser(safeUser);
  };

  const logout = () => {
    setCurrentUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      authChecked: true,
      appPublicSettings: null,
      login,
      logout,
      navigateToLogin: () => {},
      checkUserAuth: async () => {},
      checkAppState: async () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
