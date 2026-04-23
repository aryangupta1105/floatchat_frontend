import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import { LanguageProvider } from './context/LanguageContext'; // Import this
import API from "./utils/api";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

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
          const u = res.data.user;
          // Only auto-login if user is verified; otherwise stay on auth screen
          if (u.is_verified) {
            setUser(u);
            setIsAuthenticated(true);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
        })
        .finally(() => {
          setIsInitializing(false);
        });
    } else {
      setIsInitializing(false);
    }
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm animate-pulse">Initializing FloatChat...</p>
        </div>
      </div>
    );
  }

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