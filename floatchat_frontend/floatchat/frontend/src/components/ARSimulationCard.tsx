import React from 'react';
import { motion } from 'framer-motion';
import { Cuboid as Cube, Play, Maximize } from 'lucide-react';

interface ARSimulationCardProps {
  data: any;
  darkMode: boolean;
}

const ARSimulationCard: React.FC<ARSimulationCardProps> = ({ data, darkMode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`p-4 rounded-xl border-2 border-dashed ${
        darkMode ? 'border-purple-500 bg-purple-900/20' : 'border-purple-400 bg-purple-50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <motion.div
            animate={{ rotateY: [0, 180, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg"
          >
            <Cube className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h4 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              AR Ocean Simulation
            </h4>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {data.type} - {data.region}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Play className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Maximize className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
      
      <div className={`h-32 rounded-lg flex items-center justify-center ${
        darkMode ? 'bg-gray-800' : 'bg-gray-100'
      }`}>
        <div className="text-center">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className={`w-16 h-16 mx-auto mb-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center`}
          >
            <Cube className="w-8 h-8 text-white" />
          </motion.div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            AR Preview - Click Play to Launch
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default ARSimulationCard;