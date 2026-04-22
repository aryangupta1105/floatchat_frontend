import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Bot, Check, Globe, Mic, Send, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import 'regenerator-runtime/runtime';
import remarkGfm from 'remark-gfm';
import { Language, useLanguage } from '../context/LanguageContext';
import API, { API_BASE } from '../utils/api';
import { translateToEnglish, translateToUserLang } from '../utils/translationService';
import ARSimulationCard from './ARSimulationCard';
import DataCard from './DataCard';
import MessageSkeleton from './MessageSkeleton';

function isProfileData(data: any) {
  const rows = data?.rows || [];
  return rows.some((r: any) => r.depth != null && (r.temperature || r.temperature_adjusted));
}

function isTSData(data: any) {
  const rows = data?.rows || [];
  return rows.some((r: any) =>
    (r.temperature || r.temperature_adjusted) &&
    (r.salinity || r.salinity_adjusted)
  );
}

function hasFloatId(data: any) {
  const rows = data?.rows || [];
  return rows.some((r: any) => r.platform_number || r.float_id);
}

// 🔹 Visualization types to share with MainLayout/DataVisualization
export type VisualizationType = 'map' | 'profile' | 'timeseries' | 'comparison' | 'table' | 'trajectory' | 'ts';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  hasVisualization?: boolean;
  hasAR?: boolean;
  data?: any;
  visualizationType?: VisualizationType;
}

export interface VisualizationOptions {
  type: VisualizationType;
  sourceMessage: Message;
}

interface ChatInterfaceProps {
  darkMode: boolean;
  onShowVisualization: (show: boolean, options?: VisualizationOptions) => void;
}

interface ChatHistoryItem {
  _id: string;
  type: "user" | "assistant";
  content?: string;
  question?: string;
  response?: {
    content?: string;
    data?: any;
    hasVisualization?: boolean;
    visualizationType?: string | null;
  };
  createdAt: string;
}


// interface BackendResponse {
//   content: string;
//   hasVisualization?: boolean;
//   hasAR?: boolean;
//   data?: any;
//   visualizationType?: VisualizationType;
// }

// Mock backend responses for now
// const mockResponses: Record<string, BackendResponse> = {
//   salinity: {
//     content:
//       'Here are the latest salinity profiles from ARGO floats in the Indian Ocean. The data shows typical values ranging from 34.5 to 36.5 PSU at various depths.',
//     hasVisualization: true,
//     visualizationType: 'profile',
//     data: { type: 'salinity_profile', region: 'Indian Ocean' }
//   },
//   temperature: {
//     content:
//       'Temperature data from ARGO floats shows seasonal variations. Current surface temperatures range from 18°C to 28°C across different regions.',
//     hasVisualization: true,
//     visualizationType: 'timeseries',
//     data: { type: 'temperature_timeseries', region: 'Global' }
//   },
//   ar: {
//     content:
//       'Launching AR simulation for ocean current visualization. This immersive view will help you understand 3D flow patterns.',
//     hasAR: true,
//     data: { type: 'current_simulation', region: 'Pacific Ocean' }
//   },
//   float: {
//     content:
//       'Here are active ARGO floats in your area of interest. Each float provides real-time oceanographic data.',
//     hasVisualization: true,
//     visualizationType: 'map',
//     data: {
//       type: 'float_list',
//       floats: [
//         { id: 'XYZ123', location: 'Indian Ocean', status: 'active', lastContact: '2 hours ago' },
//         { id: 'ABC456', location: 'Pacific Ocean', status: 'active', lastContact: '1 hour ago' },
//         { id: 'DEF789', location: 'Atlantic Ocean', status: 'maintenance', lastContact: '6 hours ago' }
//       ]
//     }
//   },
//   default: {
//     content:
//       "I'm FloatChat, your AI assistant for ARGO ocean data analysis. I can help you visualize salinity profiles, temperature data, ocean currents, and provide information about ARGO floats. Try asking about \"salinity profiles\", \"temperature data\", or \"show AR simulation\"."
//   }
// };

// const getBackendResponse = (englishInput: string): BackendResponse => {
//   const lowerInput = englishInput.toLowerCase();
//   if (lowerInput.includes('salinity')) return mockResponses.salinity;
//   if (lowerInput.includes('temperature')) return mockResponses.temperature;
//   if (lowerInput.includes('ar') || lowerInput.includes('simulation')) return mockResponses.ar;
//   if (lowerInput.includes('float')) return mockResponses.float;
//   return mockResponses.default;
// };
// 


const ChatInterface: React.FC<ChatInterfaceProps> = ({ darkMode, onShowVisualization }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    try {
      const res = await API.get("/chat/history");
      const hist: ChatHistoryItem[] = res.data.history;

      // Backend returns pre-paired [{type:"user",...},{type:"assistant",...}] already in order
      const formatted: Message[] = hist.map(h => ({
        id: h._id,
        type: h.type as "user" | "assistant",
        content: h.type === "user" ? h.content || "" : (h.response?.content || "No response"),
        timestamp: new Date(h.createdAt),
        data: h.response?.data || null,
        hasVisualization: h.response?.hasVisualization || false,
        visualizationType: h.response?.visualizationType || null
      }));

      setMessages(formatted);
    } catch (err) {
      console.error("History fetch error", err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { t, language, setLanguage } = useLanguage();

  const languages: Array<{ code: Language; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी (Hindi)' },
    { code: 'es', label: 'Español (Spanish)' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'fr', label: 'Français (French)' },
    { code: 'zh', label: '中文 (Mandarin)' },
    { code: 'ar', label: 'العربية (Arabic)' }
  ];

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const originalInput = inputValue;
    setInputValue("");
    resetTranscript();
    setIsLoading(true);

    try {
      // 1. Translate user's query → English
      const englishQuery = await translateToEnglish(originalInput, language);

      // 2. Send to backend
      const backendRes = await API.post("/chat/process", {
        question: englishQuery,
        language
      });

      // backend sends direct response object, not {chat:...}
      const response = backendRes.data;

      // 3. Translate assistant reply → user's language
      const translatedContent = await translateToUserLang(
        response.content,
        language
      );

      // Assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: translatedContent,
        timestamp: new Date(),
        hasVisualization: response.hasVisualization,
        hasAR: response.hasAR,
        data: response.data,
        visualizationType: response.visualizationType
      };


      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error("Backend error:", err);

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "⚠️ Unable to fetch ocean data. Please try again.",
          timestamp: new Date()
        }
      ]);
    }

    setIsLoading(false);
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsRecording(false);
    } else {
      resetTranscript();
      const langMap: Record<Language, string> = {
        en: 'en-US',
        hi: 'hi-IN',
        es: 'es-ES',
        te: 'te-IN',
        ta: 'ta-IN',
        fr: 'fr-FR',
        zh: 'zh-CN',
        ar: 'ar-SA'
      };
      const langCode = langMap[language] || 'en-US';

      SpeechRecognition.startListening({ continuous: true, language: langCode });
      setIsRecording(true);
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn&apos;t support speech recognition.</span>;
  }

  // 🔹 Action button handlers
  const handleViewOnMap = (message: Message) => {
    onShowVisualization(true, {
      type: 'map',
      sourceMessage: message
    });
  };

  const handlePlotProfiles = (message: Message) => {
    const type: VisualizationType =
      message.visualizationType === 'comparison' ? 'comparison' : 'profile';
    onShowVisualization(true, {
      type,
      sourceMessage: message
    });
  };

  const handleShowAsciiTable = (message: Message) => {
    onShowVisualization(true, {
      type: 'table',
      sourceMessage: message
    });
  };

  const handleDownloadCsv = (message: Message) => {
    const rows = message.data?.rows;
    if (!rows?.length) { alert('No data available to download.'); return; }
    const floatId = rows[0]?.platform_number || rows[0]?.float_id || 'unknown';
    window.open(`${API_BASE}/data/download/csv?float_id=${floatId}`, '_blank');
  };

  const handleDownloadNetcdf = (message: Message) => {
    const rows = message.data?.rows;
    if (!rows?.length) { alert('No data available to download.'); return; }
    const floatId = rows[0]?.platform_number || rows[0]?.float_id || 'unknown';
    window.open(`${API_BASE}/data/download/netcdf?float_id=${floatId}`, '_blank');
  };

  const handleShowTrajectory = (message: Message) => {
    onShowVisualization(true, {
      type: 'trajectory',
      sourceMessage: message
    });
  };

  const handleShowTSDiagram = (message: Message) => {
    onShowVisualization(true, {
      type: 'ts',
      sourceMessage: message
    });
  };

  return (
    <div
      className={`h-full flex flex-col ${
        darkMode ? 'bg-gray-900' : 'bg-white'
      }`}
    >
      {/* Header */}
      <div
        className={`flex-shrink-0 px-5 py-3 border-b ${
          darkMode ? 'border-gray-700/60' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <Bot className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              FloatChat Assistant
            </h3>
            <p className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
              ● Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex items-start space-x-3 max-w-[80%] ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                >
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                <div className="flex flex-col space-y-2">
                  <div
                    className={`p-4 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : darkMode
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.type === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="text-sm prose-chat">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-blue-300">{children}</strong>,
                            em: ({ children }) => <em className="italic opacity-90">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0 text-blue-300">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
                            code: ({ children, className }) => {
                              const isBlock = className?.includes('language-');
                              return isBlock
                                ? <code className={`block bg-black/30 rounded-lg px-3 py-2 my-2 text-xs font-mono overflow-x-auto ${className}`}>{children}</code>
                                : <code className="bg-black/30 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>;
                            },
                            pre: ({ children }) => <pre className="my-2">{children}</pre>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-400 pl-3 my-2 opacity-80 italic">{children}</blockquote>,
                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-200">{children}</a>,
                            hr: () => <hr className="border-gray-600 my-3" />,
                            table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                            th: ({ children }) => <th className="border border-gray-600 px-2 py-1 bg-black/20 font-semibold text-left">{children}</th>,
                            td: ({ children }) => <td className="border border-gray-600 px-2 py-1">{children}</td>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {message.hasAR && message.data && (
                    <ARSimulationCard data={message.data} darkMode={darkMode} />
                  )}

                  {message.data?.floats && (
                    <div className="grid grid-cols-1 gap-2">
                      {message.data.floats.map((float: any) => (
                        <DataCard key={float.id} data={float} darkMode={darkMode} />
                      ))}
                    </div>
                  )}

                  {message.hasVisualization && (
                    <>
                      {/* Existing info chip */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`flex items-center space-x-2 p-2 rounded-lg ${
                          darkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        <span
                          className={`text-xs ${
                            darkMode ? 'text-blue-300' : 'text-blue-700'
                          }`}
                        >
                          Visualization available. Choose an action below.
                        </span>
                      </motion.div>

                      {/* 🔹 Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleViewOnMap(message)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${
                            darkMode
                              ? 'border-blue-500 text-blue-300 hover:bg-blue-900/40'
                              : 'border-blue-500 text-blue-700 hover:bg-blue-50'
                          } transition-colors`}
                        >
                          View on map
                        </button>

                        <button
                          onClick={() => handlePlotProfiles(message)}
                          disabled={!isProfileData(message.data)}
                          title={!isProfileData(message.data) ? "Requires depth-resolved temperature data" : undefined}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            !isProfileData(message.data)
                              ? 'opacity-50 cursor-not-allowed border-gray-500 text-gray-500'
                              : darkMode
                              ? 'border-emerald-500 text-emerald-300 hover:bg-emerald-900/40'
                              : 'border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          Plot profiles
                        </button>

                        <button
                          onClick={() => handleShowAsciiTable(message)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${
                            darkMode
                              ? 'border-indigo-500 text-indigo-300 hover:bg-indigo-900/40'
                              : 'border-indigo-500 text-indigo-700 hover:bg-indigo-50'
                          } transition-colors`}
                        >
                          Tabular summaries (ASCII)
                        </button>

                        <button
                          onClick={() => handleDownloadCsv(message)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${
                            darkMode
                              ? 'border-gray-500 text-gray-300 hover:bg-gray-800'
                              : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                          } transition-colors`}
                        >
                          Download CSV
                        </button>

                        <button
                          onClick={() => handleDownloadNetcdf(message)}
                          className={`px-3 py-1.5 text-xs rounded-full border ${
                            darkMode
                              ? 'border-gray-500 text-gray-300 hover:bg-gray-800'
                              : 'border-gray-400 text-gray-700 hover:bg-gray-100'
                          } transition-colors`}
                        >
                          Download NetCDF
                        </button>

                        <button
                          onClick={() => handleShowTrajectory(message)}
                          disabled={!hasFloatId(message.data)}
                          title={!hasFloatId(message.data) ? "Requires float-specific data (platform_number)" : "Show float trajectory on map"}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            !hasFloatId(message.data)
                              ? 'opacity-50 cursor-not-allowed border-gray-500 text-gray-500'
                              : darkMode
                              ? 'border-cyan-500 text-cyan-300 hover:bg-cyan-900/40'
                              : 'border-cyan-500 text-cyan-700 hover:bg-cyan-50'
                          }`}
                        >
                          Float Trajectory
                        </button>

                        <button
                          onClick={() => handleShowTSDiagram(message)}
                          disabled={!isTSData(message.data)}
                          title={!isTSData(message.data) ? "Requires temperature and salinity data" : undefined}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            !isTSData(message.data)
                              ? 'opacity-50 cursor-not-allowed border-gray-500 text-gray-500'
                              : darkMode
                              ? 'border-purple-500 text-purple-300 hover:bg-purple-900/40'
                              : 'border-purple-500 text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          T-S Diagram
                        </button>
                      </div>

                      {/* 🔹 Fallback warning for incompatible profile data */}
                      {(!isProfileData(message.data) && !isTSData(message.data)) && (
                        <motion.div 
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className={`mt-2 text-xs p-2 rounded-lg ${
                            darkMode ? 'bg-orange-900/40 text-orange-200 border border-orange-800' : 'bg-orange-50 text-orange-800 border border-orange-200'
                          }`}
                        >
                          This result is aggregated and cannot be visualized as a profile. Try asking for depth-resolved data.
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && <MessageSkeleton darkMode={darkMode} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className={`p-4 border-t ${
          darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={listening ? t.recording : t.chatPlaceholder}
              rows={1}
              className={`w-full p-3 rounded-xl border resize-none transition-all focus:ring-2 focus:ring-blue-500/20 ${
                darkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <div className="flex space-x-2">
            {/* Mic Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleRecording}
              className={`p-3 rounded-xl transition-all ${
                listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : darkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
              }`}
            >
              <Mic className={`w-5 h-5 ${listening ? 'animate-pulse' : ''}`} />
            </motion.button>

            {/* Language Selector */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLangMenu(prev => !prev)}
                className={`p-3 rounded-xl transition-all ${
                  darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
              >
                <Globe className="w-5 h-5" />
              </motion.button>

              <AnimatePresence>
                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`absolute bottom-full mb-2 -left-16 w-56 rounded-lg shadow-xl border ${
                      darkMode
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    } overflow-hidden z-50`}
                  >
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                          darkMode
                            ? 'hover:bg-gray-700 text-gray-300'
                            : 'hover:bg-gray-100 text-gray-700'
                        } ${
                          language === lang.code
                            ? darkMode
                              ? 'bg-gray-700'
                              : 'bg-gray-100'
                            : ''
                        }`}
                      >
                        <span>{lang.label}</span>
                        {language === lang.code && (
                          <Check className="w-3 h-3 text-green-500" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Send Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl hover:from-blue-600 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
