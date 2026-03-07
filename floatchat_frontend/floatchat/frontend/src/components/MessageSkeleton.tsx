import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';
import React from 'react';

interface MessageSkeletonProps {
  darkMode: boolean;
}

const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ darkMode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-start space-x-3"
    >
      {/* Pulsing bot avatar */}
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25"
      >
        <Bot className="w-4 h-4 text-white" />
      </motion.div>

      {/* Message bubble */}
      <div className={`px-5 py-4 rounded-2xl rounded-tl-md ${
        darkMode
          ? 'bg-gray-700/80 border border-gray-600/50'
          : 'bg-gray-100 border border-gray-200'
      }`}>
        <div className="flex items-center space-x-3">
          {/* Typing dots */}
          <div className="flex items-center space-x-1.5">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut'
                }}
                className={`w-2.5 h-2.5 rounded-full ${
                  darkMode
                    ? 'bg-gradient-to-b from-blue-400 to-cyan-400'
                    : 'bg-gradient-to-b from-blue-500 to-cyan-500'
                }`}
              />
            ))}
          </div>

          {/* Label */}
          <motion.span
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`text-xs font-medium flex items-center gap-1.5 ${
              darkMode ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Analyzing ocean data...
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageSkeleton;