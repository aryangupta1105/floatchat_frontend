import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import { LanguageProvider } from './context/LanguageContext'; // Import this
import API from "./utils/api";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = (userData: any) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
  localStorage.removeItem("token");
  setIsAuthenticated(false);
  setUser(null);
};

useEffect(() => {
  const token = localStorage.getItem("token");
  if (token) {
    API.get("/auth/me")
      .then((res) => {
        setUser(res.data.user);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem("token");
      });
  }
}, []);

  return (
    <LanguageProvider> 
      <div className="min-h-screen bg-gray-900">
        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AuthScreen onLogin={handleLogin} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <MainLayout user={user} onLogout={handleLogout} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LanguageProvider>
  );
}

export default App;