import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Header from './Header';
import Dashboard from './Dashboard';
import ChatInterface, { VisualizationOptions } from './ChatInterface';
import DataVisualization from './DataVisualization';
import FloatingButtons from './FloatingButtons';
import Explorer from './Explorer';
import {
  BarChart3,
  MessageSquare,
  Users,
  Globe,
  Mic,
  AlertTriangle,
  MapPin
} from 'lucide-react';

interface MainLayoutProps {
  user: any;
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showVisualization, setShowVisualization] = useState(false);
  const [vizOptions, setVizOptions] = useState<VisualizationOptions | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  const navigationItems = [
    { id: 'dashboard', name: 'Analytics Dashboard', icon: BarChart3 },
    { id: 'floatchat', name: 'FloatChat AI', icon: MessageSquare },
    { id: 'explorer', name: 'Float Explorer', icon: MapPin },
    { id: 'users', name: 'User Analytics', icon: Users },
    { id: 'anomaly', name: 'Anomaly Detection', icon: AlertTriangle },
    { id: 'multilang', name: 'Multi-Language', icon: Globe },
    { id: 'voice', name: 'Voice Recognition', icon: Mic }
  ];

  const handleShowVisualization = (show: boolean, options?: VisualizationOptions) => {
    if (!show) {
      setShowVisualization(false);
      setVizOptions(null);
    } else {
      setShowVisualization(true);
      if (options) {
        setVizOptions(options);
      }
    }
  };

  return (
    <div
      className={`min-h-screen ${
        darkMode ? 'bg-gray-900' : 'bg-gray-50'
      } transition-colors duration-300`}
    >
      <Header
        user={user}
        onLogout={onLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Top Navigation Bar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={`fixed top-16 left-0 right-0 z-40 ${
          darkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200'
        } backdrop-blur-xl border-b transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-1 overflow-x-auto">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;

              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                      : darkMode
                      ? 'hover:bg-gray-700 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.nav>

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="pt-32 pb-6 px-4 max-w-7xl mx-auto"
      >
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <Dashboard
            darkMode={darkMode}
            onOpenExplorer={() => setActiveTab('explorer')}
          />
        )}

        {/* FloatChat + Visualization side panel */}
        {activeTab === 'floatchat' && (
          <div
            className={`grid ${
              showVisualization ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            } gap-6`}
          >
            <div className="min-h-[600px]">
              <ChatInterface
                darkMode={darkMode}
                onShowVisualization={handleShowVisualization}
              />
            </div>

            {showVisualization && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
              >
                <DataVisualization darkMode={darkMode} vizOptions={vizOptions} />
              </motion.div>
            )}
          </div>
        )}

        {/* Float Explorer tab */}
        {activeTab === 'explorer' && (
          <Explorer darkMode={darkMode} />
        )}

        {/* User Analytics */}
        {activeTab === 'users' && (
          <div
            className={`rounded-2xl p-8 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-xl`}
          >
            <h2
              className={`text-2xl font-bold mb-6 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              User Analytics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                className={`p-6 rounded-xl ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Active Users
                </h3>
                <p className="text-3xl font-bold text-blue-500">1,247</p>
                <p
                  className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  +12% from last week
                </p>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Data Queries
                </h3>
                <p className="text-3xl font-bold text-green-500">45,892</p>
                <p
                  className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  +8% from yesterday
                </p>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-2 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Global Reach
                </h3>
                <p className="text-3xl font-bold text-purple-500">89</p>
                <p
                  className={`text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Countries served
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Detection */}
        {activeTab === 'anomaly' && (
          <div
            className={`rounded-2xl p-8 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-xl`}
          >
            <h2
              className={`text-2xl font-bold mb-6 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Anomaly Detection System
            </h2>
            <div className="space-y-4">
              {[
                {
                  type: 'Temperature Spike',
                  location: 'Pacific Ocean',
                  severity: 'High',
                  time: '2 hours ago'
                },
                {
                  type: 'Salinity Drop',
                  location: 'Atlantic Ocean',
                  severity: 'Medium',
                  time: '4 hours ago'
                },
                {
                  type: 'Current Deviation',
                  location: 'Indian Ocean',
                  severity: 'Low',
                  time: '6 hours ago'
                }
              ].map((anomaly, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border-l-4 ${
                    anomaly.severity === 'High'
                      ? 'border-red-500 bg-red-500/10'
                      : anomaly.severity === 'Medium'
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-green-500 bg-green-500/10'
                  } ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3
                        className={`font-semibold ${
                          darkMode ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {anomaly.type}
                      </h3>
                      <p
                        className={`text-sm ${
                          darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {anomaly.location} • {anomaly.time}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        anomaly.severity === 'High'
                          ? 'bg-red-500 text-white'
                          : anomaly.severity === 'Medium'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}
                    >
                      {anomaly.severity}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Language */}
        {activeTab === 'multilang' && (
          <div
            className={`rounded-2xl p-8 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-xl`}
          >
            <h2
              className={`text-2xl font-bold mb-6 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Multi-Language Support
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { lang: 'English', code: 'EN', users: '45%' },
                { lang: 'Spanish', code: 'ES', users: '23%' },
                { lang: 'French', code: 'FR', users: '12%' },
                { lang: 'German', code: 'DE', users: '8%' },
                { lang: 'Chinese', code: 'ZH', users: '7%' },
                { lang: 'Japanese', code: 'JA', users: '3%' },
                { lang: 'Portuguese', code: 'PT', users: '2%' },
                { lang: 'Others', code: '...', users: '1%' }
              ].map((language, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg text-center ${
                    darkMode ? 'bg-gray-700' : 'bg-gray-50'
                  } hover:scale-105 transition-transform cursor-pointer`}
                >
                  <div className="text-2xl font-bold text-blue-500 mb-1">
                    {language.code}
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      darkMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {language.lang}
                  </div>
                  <div
                    className={`text-xs ${
                      darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {language.users}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Recognition */}
        {activeTab === 'voice' && (
          <div
            className={`rounded-2xl p-8 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-xl`}
          >
            <h2
              className={`text-2xl font-bold mb-6 ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}
            >
              Voice Recognition System
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className={`p-6 rounded-xl ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Voice Commands
                </h3>
                <div className="space-y-2">
                  {[
                    '"Show salinity data"',
                    '"Display temperature map"',
                    '"Find ARGO floats"',
                    '"Analyze ocean currents"'
                  ].map((command, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        darkMode ? 'bg-gray-600' : 'bg-gray-200'
                      } text-sm`}
                    >
                      {command}
                    </div>
                  ))}
                </div>
              </div>
              <div
                className={`p-6 rounded-xl ${
                  darkMode ? 'bg-gray-700' : 'bg-gray-50'
                }`}
              >
                <h3
                  className={`text-lg font-semibold mb-4 ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  Recognition Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Accuracy
                    </span>
                    <span className="text-green-500 font-semibold">94.7%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Response Time
                    </span>
                    <span className="text-blue-500 font-semibold">0.8s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Languages
                    </span>
                    <span className="text-purple-500 font-semibold">12</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.main>

      <FloatingButtons darkMode={darkMode} />
    </div>
  );
};

export default MainLayout;
