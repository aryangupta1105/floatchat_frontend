import React from 'react';
import { motion } from 'framer-motion';
import { Bot } from 'lucide-react';

interface MessageSkeletonProps {
  darkMode: boolean;
}

const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ darkMode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start space-x-3"
    >
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      
      <div className={`p-4 rounded-2xl max-w-[80%] ${
        darkMode ? 'bg-gray-700' : 'bg-gray-100'
      }`}>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className={`h-4 rounded ${
                darkMode ? 'bg-gray-600' : 'bg-gray-200'
              } ${i === 2 ? 'w-2/3' : 'w-full'}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageSkeleton;