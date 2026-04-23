import { motion } from 'framer-motion';
import { LogOut, Moon, Settings, Sun, User, Waves } from 'lucide-react';
import React, { useState } from 'react';

interface HeaderProps {
  user: any;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, darkMode, setDarkMode }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[1001] h-16 ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } border-b transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center">
        <div className="flex items-center justify-between w-full">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="bg-gradient-to-r from-blue-500 to-cyan-400 p-2 rounded-lg"
            >
              <Waves className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                FloatChat
              </h1>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                AI Ocean Data Interface
              </p>
            </div>
          </motion.div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            
            {/* Dark Mode Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </motion.button>

            {/* User Profile */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center space-x-2 p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className={`hidden sm:block text-sm font-medium ${
                  darkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {user?.name || 'User'}
                </span>
              </motion.button>

              {/* User Menu */}
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute right-0 top-12 w-48 rounded-lg shadow-xl border ${
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  } overflow-hidden z-50`}
                >
                  <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {user?.name || 'User'}
                    </p>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {user?.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2 ${
                        darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={onLogout}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center space-x-2 ${
                        darkMode ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-600'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;