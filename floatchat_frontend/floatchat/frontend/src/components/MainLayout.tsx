import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Clock,
    Database,
    Globe,
    Loader2,
    MapPin,
    MessageSquare,
    Mic,
    Minus,
    TrendingDown,
    TrendingUp,
    UserCheck,
    Users
} from 'lucide-react';
import React, { Suspense, useState } from 'react';
import { useGetUserStatsQuery } from '../store/apiSlice';
import { VisualizationOptions } from './ChatInterface';
import FloatingButtons from './FloatingButtons';
import Header from './Header';

// Lazy-load heavy components (Plotly ~3MB, Leaflet ~200KB)
const Dashboard = React.lazy(() => import('./Dashboard'));
const Explorer = React.lazy(() => import('./Explorer'));
const ChatInterface = React.lazy(() => import('./ChatInterface'));
const DataVisualization = React.lazy(() => import('./DataVisualization'));

const TabSpinner: React.FC<{ darkMode: boolean }> = ({ darkMode }) => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    <span className={`ml-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading…</span>
  </div>
);

interface MainLayoutProps {
  user: any;
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showVisualization, setShowVisualization] = useState(false);
  const [vizOptions, setVizOptions] = useState<VisualizationOptions | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  // RTK Query: user stats fetched on demand, cached for 5 min
  const { data: userStats, isFetching: userStatsLoading, refetch: refetchUserStats } = useGetUserStatsQuery(undefined, {
    skip: activeTab !== 'users',
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const navigationItems = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'floatchat', name: 'FloatChat AI', icon: MessageSquare },
    { id: 'explorer', name: 'Float Explorer', icon: MapPin },
    { id: 'users', name: 'User Analytics', icon: Users },
    { id: 'anomaly', name: 'Anomaly Detection', icon: AlertTriangle },
    { id: 'multilang', name: 'Multi-Language', icon: Globe },
    { id: 'voice', name: 'Voice', icon: Mic }
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
        className={`fixed top-16 left-0 right-0 z-[1000] ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } border-b transition-colors duration-300`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-2">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md'
                      : darkMode
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-100'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.name}</span>
                </button>
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
        className="pt-[128px] pb-6 px-4 max-w-7xl mx-auto"
      >
        <Suspense fallback={<TabSpinner darkMode={darkMode} />}>
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
                <DataVisualization
                  darkMode={darkMode}
                  vizOptions={vizOptions}
                  onClose={() => handleShowVisualization(false)}
                />
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
          <div className={`rounded-2xl p-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                User Analytics
              </h2>
              <button
                onClick={() => refetchUserStats()}
                disabled={userStatsLoading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                } transition-colors disabled:opacity-50`}
              >
                {userStatsLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Activity className="w-4 h-4" />}
                Refresh
              </button>
            </div>

            {userStatsLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className={`ml-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading analytics...</span>
              </div>
            )}



            {userStats && !userStatsLoading && (() => {
              const delta = userStats.query_delta_pct;
              const DeltaIcon = delta === null ? Minus : delta > 0 ? TrendingUp : TrendingDown;
              const deltaColor = delta === null ? 'text-gray-400' : delta > 0 ? 'text-green-400' : 'text-red-400';
              const deltaText = delta === null ? 'No data yesterday' : `${delta > 0 ? '+' : ''}${delta}% vs yesterday`;
              const maxCount = Math.max(...(userStats.queries_per_day.counts.length ? userStats.queries_per_day.counts : [1]));

              return (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Registered Users', value: userStats.total_users.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', sub: 'Total accounts' },
                      { label: 'Total Queries', value: userStats.total_queries.toLocaleString(), icon: Database, color: 'text-green-500', bg: 'bg-green-500/10', sub: 'All time' },
                      { label: "Today's Queries", value: userStats.today_queries.toLocaleString(), icon: Activity, color: 'text-cyan-500', bg: 'bg-cyan-500/10', sub: deltaText, subColor: deltaColor, SubIcon: DeltaIcon },
                      { label: 'Avg Response', value: userStats.avg_response_ms > 0 ? `${(userStats.avg_response_ms / 1000).toFixed(1)}s` : '—', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10', sub: 'LLM + SQL pipeline' },
                    ].map((card, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className={`p-5 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</span>
                          <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                            <card.icon className={`w-4 h-4 ${card.color}`} />
                          </div>
                        </div>
                        <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
                        <div className={`flex items-center gap-1 mt-1 text-xs ${card.subColor || (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                          {card.SubIcon && <card.SubIcon className="w-3 h-3" />}
                          <span>{card.sub}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Queries per day bar chart */}
                    <div className={`p-5 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <h3 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Queries — Last 7 Days
                      </h3>
                      {userStats.queries_per_day.days.length === 0 ? (
                        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No query data yet.</p>
                      ) : (
                        <div className="flex items-end gap-2 h-32">
                          {userStats.queries_per_day.days.map((day, i) => {
                            const count = userStats.queries_per_day.counts[i];
                            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{count}</span>
                                <div className="w-full rounded-t-md bg-blue-500/80" style={{ height: `${Math.max(pct, 4)}%` }} />
                                <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{day}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Query type breakdown */}
                    <div className={`p-5 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <h3 className={`text-sm font-semibold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        Query Type Breakdown
                      </h3>
                      {userStats.query_types.length === 0 ? (
                        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No query type data yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {userStats.query_types.map((qt, i) => {
                            const total = userStats.query_types.reduce((s, x) => s + x.count, 0);
                            const pct = total > 0 ? Math.round((qt.count / total) * 100) : 0;
                            const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'];
                            return (
                              <div key={i}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className={`capitalize font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{qt.type}</span>
                                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>{qt.count} ({pct}%)</span>
                                </div>
                                <div className={`h-2 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                                  <div className={`h-2 rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Users table */}
                  <div className={`p-5 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <UserCheck className="w-4 h-4 text-blue-400" /> Recently Registered Users
                    </h3>
                    {userStats.recent_users.length === 0 ? (
                      <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>No users yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              <th className="text-left pb-2 pr-4">Username</th>
                              <th className="text-left pb-2 pr-4">Email</th>
                              <th className="text-left pb-2">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-600/30">
                            {userStats.recent_users.map((u, i) => (
                              <tr key={i}>
                                <td className={`py-2 pr-4 font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{u.username}</td>
                                <td className={`py-2 pr-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{u.email}</td>
                                <td className={`py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {new Date(u.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
        </Suspense>
      </motion.main>

      <FloatingButtons darkMode={darkMode} />
    </div>
  );
};

export default MainLayout;
