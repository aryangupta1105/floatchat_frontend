import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Activity, Clock, AlertTriangle } from 'lucide-react';

interface DataCardProps {
  data: {
    id: string;
    location: string;
    status: string;
    lastContact: string;
  };
  darkMode: boolean;
}

const DataCard: React.FC<DataCardProps> = ({ data, darkMode }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/20';
      case 'maintenance': return 'text-yellow-500 bg-yellow-500/20';
      case 'inactive': return 'text-red-500 bg-red-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return Activity;
      case 'maintenance': return AlertTriangle;
      default: return Activity;
    }
  };

  const StatusIcon = getStatusIcon(data.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className={`p-4 rounded-lg border ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } hover:shadow-md transition-all cursor-pointer`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Float {data.id}
            </h4>
            <div className="flex items-center space-x-2 text-sm">
              <MapPin className={`w-3 h-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                {data.location}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(data.status)}`}>
            <StatusIcon className="w-3 h-3" />
            <span className="capitalize">{data.status}</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
            <Clock className="w-3 h-3" />
            <span>{data.lastContact}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DataCard;