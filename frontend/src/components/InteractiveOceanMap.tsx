import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Activity, Thermometer, Droplets, Navigation, Zap } from 'lucide-react';

interface FloatData {
  id: string;
  lat: number;
  lng: number;
  temperature: number;
  salinity: number;
  depth: number;
  status: 'active' | 'maintenance' | 'inactive';
  lastUpdate: string;
  region: string;
}

interface InteractiveOceanMapProps {
  darkMode: boolean;
}

const InteractiveOceanMap: React.FC<InteractiveOceanMapProps> = ({ darkMode }) => {
  const [selectedFloat, setSelectedFloat] = useState<FloatData | null>(null);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [hoveredFloat, setHoveredFloat] = useState<string | null>(null);

  // Mock ARGO float data with realistic ocean positions
  const floatData: FloatData[] = [
    { id: 'ARG001', lat: 35, lng: -40, temperature: 18.5, salinity: 35.2, depth: 1250, status: 'active', lastUpdate: '2 min ago', region: 'North Atlantic' },
    { id: 'ARG002', lat: -20, lng: 60, temperature: 26.8, salinity: 35.8, depth: 980, status: 'active', lastUpdate: '1 min ago', region: 'Indian Ocean' },
    { id: 'ARG003', lat: 10, lng: -120, temperature: 24.2, salinity: 34.9, depth: 1450, status: 'active', lastUpdate: '3 min ago', region: 'Pacific Ocean' },
    { id: 'ARG004', lat: -45, lng: 140, temperature: 12.1, salinity: 34.2, depth: 2100, status: 'maintenance', lastUpdate: '15 min ago', region: 'Southern Ocean' },
    { id: 'ARG005', lat: 65, lng: -150, temperature: -1.2, salinity: 32.8, depth: 800, status: 'active', lastUpdate: '5 min ago', region: 'Arctic Ocean' },
    { id: 'ARG006', lat: -10, lng: -30, temperature: 25.6, salinity: 36.1, depth: 1680, status: 'active', lastUpdate: '1 min ago', region: 'South Atlantic' },
    { id: 'ARG007', lat: 40, lng: 140, temperature: 19.8, salinity: 34.6, depth: 1320, status: 'active', lastUpdate: '4 min ago', region: 'North Pacific' },
    { id: 'ARG008', lat: -35, lng: 20, temperature: 16.4, salinity: 35.4, depth: 1890, status: 'inactive', lastUpdate: '2 hours ago', region: 'South Atlantic' },
    { id: 'ARG009', lat: 25, lng: 65, temperature: 28.1, salinity: 36.2, depth: 750, status: 'active', lastUpdate: '30 sec ago', region: 'Arabian Sea' },
    { id: 'ARG010', lat: -60, lng: -45, temperature: 4.2, salinity: 34.1, depth: 2400, status: 'active', lastUpdate: '6 min ago', region: 'Southern Ocean' }
  ];

  // Animation cycle for ocean waves
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'from-green-400 to-emerald-500';
      case 'maintenance': return 'from-yellow-400 to-orange-500';
      case 'inactive': return 'from-red-400 to-red-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getFloatPosition = (lat: number, lng: number) => {
    // Convert lat/lng to SVG coordinates (simplified projection)
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  return (
    <div className="relative w-full h-full">
      {/* Ocean Background with Animated Waves */}
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{
            background: darkMode 
              ? 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #2563eb 50%, #3b82f6 75%, #60a5fa 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 25%, #1d4ed8 50%, #1e40af 75%, #1e3a8a 100%)'
          }}
        >
          {/* Animated Ocean Waves */}
          {[...Array(8)].map((_, i) => (
            <motion.path
              key={i}
              d={`M0,${50 + i * 2} Q25,${45 + i * 2 + Math.sin(animationPhase * 0.1 + i) * 3} 50,${50 + i * 2} T100,${50 + i * 2}`}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.2"
              animate={{
                d: `M0,${50 + i * 2} Q25,${45 + i * 2 + Math.sin((animationPhase + i * 30) * 0.1) * 3} 50,${50 + i * 2} T100,${50 + i * 2}`
              }}
              transition={{ duration: 0.1 }}
            />
          ))}

          {/* Continental Outlines (Simplified) */}
          <g fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="0.1">
            {/* North America */}
            <path d="M15,25 L25,20 L30,25 L28,35 L20,40 L15,35 Z" />
            {/* South America */}
            <path d="M20,45 L25,40 L30,50 L28,65 L22,70 L18,60 Z" />
            {/* Europe */}
            <path d="M45,20 L55,18 L58,25 L52,30 L45,28 Z" />
            {/* Africa */}
            <path d="M45,35 L55,30 L58,45 L55,60 L48,65 L42,50 Z" />
            {/* Asia */}
            <path d="M60,15 L80,12 L85,25 L82,35 L70,40 L60,30 Z" />
            {/* Australia */}
            <path d="M75,55 L85,52 L88,60 L82,65 L75,62 Z" />
          </g>

          {/* ARGO Float Markers */}
          {floatData.map((float, index) => {
            const position = getFloatPosition(float.lat, float.lng);
            const isHovered = hoveredFloat === float.id;
            const isSelected = selectedFloat?.id === float.id;
            
            return (
              <g key={float.id}>
                {/* Ripple Effect for Active Floats */}
                {float.status === 'active' && (
                  <motion.circle
                    cx={position.x}
                    cy={position.y}
                    r="0"
                    fill="none"
                    stroke="rgba(34, 197, 94, 0.6)"
                    strokeWidth="0.1"
                    animate={{
                      r: [0, 3, 0],
                      opacity: [1, 0.3, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.3
                    }}
                  />
                )}

                {/* Float Marker */}
                <motion.circle
                  cx={position.x}
                  cy={position.y}
                  r={isHovered || isSelected ? "1.2" : "0.8"}
                  className="cursor-pointer"
                  fill={`url(#gradient-${float.id})`}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="0.1"
                  animate={{
                    scale: isHovered ? 1.3 : 1,
                    y: position.y + Math.sin(animationPhase * 0.05 + index) * 0.3
                  }}
                  transition={{ duration: 0.2 }}
                  onMouseEnter={() => setHoveredFloat(float.id)}
                  onMouseLeave={() => setHoveredFloat(null)}
                  onClick={() => setSelectedFloat(selectedFloat?.id === float.id ? null : float)}
                />

                {/* Gradient Definition */}
                <defs>
                  <radialGradient id={`gradient-${float.id}`}>
                    <stop offset="0%" stopColor={float.status === 'active' ? '#10b981' : float.status === 'maintenance' ? '#f59e0b' : '#ef4444'} />
                    <stop offset="100%" stopColor={float.status === 'active' ? '#059669' : float.status === 'maintenance' ? '#d97706' : '#dc2626'} />
                  </radialGradient>
                </defs>

                {/* Float ID Label */}
                {(isHovered || isSelected) && (
                  <motion.text
                    x={position.x}
                    y={position.y - 2}
                    textAnchor="middle"
                    fontSize="1.2"
                    fill="white"
                    fontWeight="bold"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {float.id}
                  </motion.text>
                )}
              </g>
            );
          })}

          {/* Data Flow Lines (connecting nearby floats) */}
          {floatData.map((float, i) => {
            const nearbyFloat = floatData[i + 1];
            if (!nearbyFloat) return null;
            
            const pos1 = getFloatPosition(float.lat, float.lng);
            const pos2 = getFloatPosition(nearbyFloat.lat, nearbyFloat.lng);
            
            return (
              <motion.line
                key={`connection-${i}`}
                x1={pos1.x}
                y1={pos1.y}
                x2={pos2.x}
                y2={pos2.y}
                stroke="rgba(59, 130, 246, 0.3)"
                strokeWidth="0.1"
                strokeDasharray="0.5,0.5"
                animate={{
                  strokeDashoffset: [0, -1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Float Information Panel */}
      <AnimatePresence>
        {selectedFloat && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={`absolute top-4 right-4 w-80 p-6 rounded-2xl shadow-2xl border ${
              darkMode ? 'bg-gray-800/95 border-gray-700' : 'bg-white/95 border-gray-200'
            } backdrop-blur-xl`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${getStatusColor(selectedFloat.status)}`}>
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedFloat.id}
                  </h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedFloat.region}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFloat(null)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                  selectedFloat.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  selectedFloat.status === 'maintenance' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {selectedFloat.status}
                </span>
              </div>

              {/* Temperature */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Thermometer className="w-4 h-4 text-red-400" />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Temperature</span>
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFloat.temperature}°C
                </span>
              </div>

              {/* Salinity */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Salinity</span>
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFloat.salinity} PSU
                </span>
              </div>

              {/* Depth */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-purple-400" />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Depth</span>
                </div>
                <span className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFloat.depth}m
                </span>
              </div>

              {/* Coordinates */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Position</span>
                </div>
                <span className={`font-semibold text-xs ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedFloat.lat}°, {selectedFloat.lng}°
                </span>
              </div>

              {/* Last Update */}
              <div className="pt-3 border-t border-gray-600">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Last Update</span>
                  <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {selectedFloat.lastUpdate}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className={`absolute bottom-4 left-4 p-4 rounded-xl ${
        darkMode ? 'bg-gray-800/90' : 'bg-white/90'
      } backdrop-blur-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <h4 className={`font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          ARGO Float Status
        </h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></div>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Active ({floatData.filter(f => f.status === 'active').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"></div>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Maintenance ({floatData.filter(f => f.status === 'maintenance').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-600"></div>
            <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Inactive ({floatData.filter(f => f.status === 'inactive').length})</span>
          </div>
        </div>
      </div>

      {/* Real-time Indicator */}
      <div className={`absolute top-4 left-4 flex items-center space-x-2 px-3 py-2 rounded-lg ${
        darkMode ? 'bg-gray-800/90' : 'bg-white/90'
      } backdrop-blur-sm border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-green-500 rounded-full"
        />
        <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Live Data
        </span>
      </div>
    </div>
  );
};

export default InteractiveOceanMap;