import React from 'react';
import { motion } from 'framer-motion';
import { Settings, HelpCircle } from 'lucide-react';

interface FloatingButtonsProps {
  darkMode: boolean;
}

const FloatingButtons: React.FC<FloatingButtonsProps> = ({ darkMode }) => {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-50">
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`w-12 h-12 rounded-full shadow-lg transition-all ${
          darkMode 
            ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700' 
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        } backdrop-blur-sm`}
      >
        <Settings className="w-5 h-5 mx-auto" />
      </motion.button>
      
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-full shadow-lg hover:from-blue-600 hover:to-cyan-500 transition-all"
      >
        <HelpCircle className="w-5 h-5 mx-auto" />
      </motion.button>
    </div>
  );
};

export default FloatingButtons;