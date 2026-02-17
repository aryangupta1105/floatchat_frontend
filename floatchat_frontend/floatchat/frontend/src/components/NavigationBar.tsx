import React from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  AlertTriangle,
  Bell,
  Globe,
  Mic,
  BarChart3,
  MapPin
} from 'lucide-react';

interface NavigationBarProps {
  activeFeature: string;
  setActiveFeature: (feature: string) => void;
  darkMode: boolean;
}

const NavigationBar: React.FC<NavigationBarProps> = ({
  activeFeature,
  setActiveFeature,
  darkMode
}) => {
  const features = [
    { id: 'chat', name: 'Chat Interface', icon: MessageCircle, status: 'active' },
    { id: 'explorer', name: 'Float Explorer', icon: MapPin, status: 'active' }, // 🔹 NEW
    { id: 'anomaly', name: 'Anomaly Detection', icon: AlertTriangle, status: 'active' },
    { id: 'alerts', name: 'Personalized Alerts', icon: Bell, status: 'warning' },
    { id: 'multilang', name: 'Multi-language', icon: Globe, status: 'inactive' },
    { id: 'voice', name: 'Voice Support', icon: Mic, status: 'inactive' },
    { id: 'analytics', name: 'Analytics', icon: BarChart3, status: 'active' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
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
          {features.map((feature) => {
            const IconComponent = feature.icon;
            const isActive = activeFeature === feature.id;

            return (
              <motion.button
                key={feature.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveFeature(feature.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : darkMode
                    ? 'hover:bg-gray-700 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="relative">
                  <IconComponent className="w-4 h-4" />
                  <div
                    className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getStatusColor(
                      feature.status
                    )}`}
                  />
                </div>
                <span className="hidden sm:inline">{feature.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};

export default NavigationBar;
