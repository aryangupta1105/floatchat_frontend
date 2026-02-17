import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { motion } from 'framer-motion';
import { Globe2, Thermometer, Activity, Database, Clock } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface DashboardProps {
  darkMode: boolean;
  onOpenExplorer: () => void; // used to jump to Float Explorer tab
}

// 🌊 Mock global ARGO floats (Indian + global basins)
const mockFloats = [
  // ========= INDIAN OCEAN / ARABIAN SEA / BAY OF BENGAL =========
  { id: '2903320', lat: -10.5, lon: 78.2, basin: 'Indian Ocean' },
  { id: '2903321', lat: 5.2,   lon: 65.4, basin: 'Arabian Sea' },
  { id: '2903322', lat: 12.3,  lon: 90.1, basin: 'Bay of Bengal' },

  { id: '2903323', lat: -2.1,  lon: 75.8, basin: 'Indian Ocean' },
  { id: '2903324', lat: -8.7,  lon: 82.4, basin: 'Indian Ocean' },
  { id: '2903325', lat: 3.4,   lon: 78.9, basin: 'Indian Ocean' },

  { id: '2903326', lat: 17.2,  lon: 67.8, basin: 'Arabian Sea' },
  { id: '2903327', lat: 14.1,  lon: 62.3, basin: 'Arabian Sea' },
  { id: '2903328', lat: 11.9,  lon: 58.4, basin: 'Arabian Sea' },

  { id: '2903329', lat: 18.4,  lon: 88.3, basin: 'Bay of Bengal' },
  { id: '2903330', lat: 10.6,  lon: 92.1, basin: 'Bay of Bengal' },
  { id: '2903331', lat: 7.3,   lon: 86.7, basin: 'Bay of Bengal' },

  { id: '2903332', lat: -22.5, lon: 76.3, basin: 'Southern Indian Ocean' },
  { id: '2903333', lat: -18.9, lon: 84.2, basin: 'Southern Indian Ocean' },
  { id: '2903334', lat: -25.1, lon: 88.9, basin: 'Southern Indian Ocean' },

  // ========= PACIFIC OCEAN =========
  { id: '2903335', lat: 2.1,   lon: -155.4, basin: 'Equatorial Pacific' },
  { id: '2903336', lat: -12.8, lon: -140.2, basin: 'South Pacific' },
  { id: '2903337', lat: 28.4,  lon: -135.9, basin: 'North Pacific' },

  // ========= ATLANTIC OCEAN =========
  { id: '2903338', lat: 14.5,  lon: -45.3,  basin: 'North Atlantic' },
  { id: '2903339', lat: -20.7, lon: -30.1,  basin: 'South Atlantic' },
  { id: '2903340', lat: 5.8,   lon: -20.4,  basin: 'Equatorial Atlantic' },

  // ========= SOUTHERN OCEAN =========
  { id: '2903341', lat: -45.2, lon: 120.4,  basin: 'Southern Ocean' },
  { id: '2903342', lat: -52.7, lon: -30.9,  basin: 'Southern Ocean' },

  // ========= ARCTIC OCEAN =========
  { id: '2903343', lat: 78.4,  lon: -150.2, basin: 'Arctic Ocean' },
  { id: '2903344', lat: 82.1,  lon: 40.6,   basin: 'Arctic Ocean' }
];

// 🗺️ Mini spatial map for the dashboard
const SpatialMap: React.FC = () => {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden">
      <MapContainer
        center={[0, 40]} // global-ish center
        zoom={2}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mockFloats.map(f => (
          <Marker key={f.id} position={[f.lat, f.lon]}>
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="rounded-md bg-white px-3 py-2 text-[11px] shadow-lg leading-tight">
                <div className="font-semibold">ARGO Float {f.id}</div>
                <div>Basin: {f.basin}</div>
                <div>
                  Lat: {f.lat.toFixed(2)}, Lon: {f.lon.toFixed(2)}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ darkMode, onOpenExplorer }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '1m' | '6m' | '1y'>('6m');

  const cardBase = darkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-900';

  const subtleText = darkMode ? 'text-gray-400' : 'text-gray-600';

  // Mock stats for now
  const stats = [
    { label: 'Total ARGO Floats', value: '3,842', icon: Globe2, color: 'text-blue-500' },
    { label: 'Profiles (6 Months)', value: '128,902', icon: Activity, color: 'text-green-500' },
    { label: 'Latest Update', value: '17 mins ago', icon: Clock, color: 'text-yellow-500' },
    { label: 'BGC Floats', value: '641', icon: Database, color: 'text-purple-500' },
    { label: 'Core Floats', value: '3,201', icon: Thermometer, color: 'text-pink-500' }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Ocean Overview
          </h1>
          <p className={subtleText}>
            Real-time global snapshot of ARGO float activity
          </p>
        </div>

        {/* Time Filter */}
        <div className="flex gap-2">
          {(['7d', '1m', '6m', '1y'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : darkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`p-5 rounded-xl border shadow ${cardBase}`}
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <span className={`text-xs ${subtleText}`}>Live</span>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className={`text-sm ${subtleText}`}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Map + Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 🗺️ ARGO Float Distribution with mini Leaflet map */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">ARGO Float Distribution</h3>
            <span className={`text-xs ${subtleText}`}>
              Click map to open Float Explorer
            </span>
          </div>

          <div
            className="relative h-[300px] w-full rounded-xl overflow-hidden cursor-pointer group"
            onClick={onOpenExplorer}
          >
            <SpatialMap />

            {/* Overlay label + CTA */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] bg-black/50 text-white backdrop-blur-sm">
              Global ARGO floats (preview)
            </div>
            <div className="pointer-events-none absolute right-3 bottom-3 rounded-full px-3 py-1 text-[11px] bg-blue-600/80 text-white backdrop-blur-sm group-hover:bg-blue-500">
              Open full Float Explorer →
            </div>
          </div>
        </div>

        {/* 📉 Profile Activity Trend chart */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <h3 className="text-lg font-semibold mb-2">Profile Activity Trend</h3>
          <div className="h-[300px]">
            <Plot
              data={[
                {
                  x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                  y: [1200, 1900, 3000, 2800, 3500, 4200],
                  type: 'scatter',
                  mode: 'lines+markers'
                }
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: darkMode ? '#e5e7eb' : '#111827' },
                margin: { t: 20, r: 20, b: 40, l: 50 }
              }}
              style={{ width: '100%', height: '100%' }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className={`rounded-2xl p-6 border ${cardBase}`}>
        <h3 className="text-lg font-semibold mb-4">System Health & Data Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: 'NetCDF Ingestion', status: 'Online' },
            { name: 'Vector DB (FAISS)', status: 'Online' },
            { name: 'LLM RAG Engine', status: 'Online' },
            { name: 'Satellite Sync', status: 'Degraded' }
          ].map((item) => (
            <div
              key={item.name}
              className={`p-4 rounded-xl ${
                darkMode ? 'bg-gray-900' : 'bg-gray-100'
              } flex justify-between`}
            >
              <span>{item.name}</span>
              <span
                className={`text-sm font-semibold ${
                  item.status === 'Online'
                    ? 'text-green-500'
                    : 'text-yellow-500'
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
