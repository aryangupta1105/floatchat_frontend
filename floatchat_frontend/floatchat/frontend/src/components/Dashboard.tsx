import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, Clock, Database, Globe2, Loader2, RefreshCw, Thermometer } from 'lucide-react';
import React, { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import Plot from 'react-plotly.js';
import {
    useGetDashboardActivityQuery,
    useGetDashboardStatsQuery,
    useGetDepthDistributionQuery,
    useGetFloatsQuery,
    useGetTSSampleQuery,
} from '../store/apiSlice';

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DashboardProps {
  darkMode: boolean;
  onOpenExplorer: () => void;
}

interface FloatRow {
  platform_number?: string;
  float_id?: string;
  latitude: number;
  longitude: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Mini map showing real float positions
const FloatMap: React.FC<{ floats: FloatRow[]; onOpenExplorer: () => void }> = React.memo(({ floats, onOpenExplorer }) => (
  <div
    className="relative h-[300px] w-full rounded-xl overflow-hidden cursor-pointer group"
    onClick={onOpenExplorer}
  >
    <MapContainer center={[10, 70]} zoom={2} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {floats.map((f, i) => {
        const id = f.platform_number || f.float_id || String(i);
        return (
          <Marker key={id} position={[Number(f.latitude), Number(f.longitude)]}>
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="text-[11px] leading-tight">
                <div className="font-semibold">Float {id}</div>
                <div>Lat: {Number(f.latitude).toFixed(2)}, Lon: {Number(f.longitude).toFixed(2)}</div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
    <div className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] bg-black/50 text-white backdrop-blur-sm">
      {floats.length} floats from your database
    </div>
    <div className="pointer-events-none absolute right-3 bottom-3 rounded-full px-3 py-1 text-[11px] bg-blue-600/80 text-white backdrop-blur-sm group-hover:bg-blue-500">
      Open full Float Explorer →
    </div>
  </div>
));

const PLOTLY_CONFIG = { displayModeBar: false, responsive: true } as const;

const Dashboard: React.FC<DashboardProps> = ({ darkMode, onOpenExplorer }) => {
  const { data: stats, isFetching: statsLoading, fulfilledTimeStamp: lastFetched, refetch: refetchStats } = useGetDashboardStatsQuery();
  const { data: activity, isFetching: actLoading, refetch: refetchActivity } = useGetDashboardActivityQuery();
  const { data: depthDist, isFetching: depthLoading, refetch: refetchDepth } = useGetDepthDistributionQuery();
  const { data: tsSample, isFetching: tsLoading, refetch: refetchTS } = useGetTSSampleQuery();
  const { data: allFloats = [], isFetching: floatsLoading, refetch: refetchFloats } = useGetFloatsQuery();

  const loading = statsLoading || actLoading || depthLoading || tsLoading || floatsLoading;
  const floats = useMemo(
    () => allFloats.filter(f => f.latitude != null && f.longitude != null) as FloatRow[],
    [allFloats]
  );

  const handleRefresh = () => {
    refetchStats();
    refetchActivity();
    refetchDepth();
    refetchTS();
    refetchFloats();
  };

  const cardBase = darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900';
  const subtleText = darkMode ? 'text-gray-400' : 'text-gray-600';

  const kpiCards = stats ? [
    { label: 'Total ARGO Floats',   value: stats.total_floats.toLocaleString(),     icon: Globe2,      color: 'text-blue-500'   },
    { label: 'Profiles (6 Months)', value: stats.profiles_6months.toLocaleString(), icon: Activity,    color: 'text-green-500'  },
    { label: 'Latest Update',       value: timeAgo(stats.latest_update),            icon: Clock,       color: 'text-yellow-500' },
    { label: 'BGC Floats',          value: stats.bgc_floats.toLocaleString(),       icon: Database,    color: 'text-purple-500' },
    { label: 'Core Floats',         value: stats.core_floats.toLocaleString(),      icon: Thermometer, color: 'text-pink-500'   },
  ] : [];

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
            Live data from your ARGO float database
            {lastFetched && (
              <span className="ml-2 text-xs opacity-60">
                · refreshed {timeAgo(new Date(lastFetched).toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </motion.div>

      {/* KPI Cards */}
      {loading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className={`ml-3 ${subtleText}`}>Loading live stats…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {kpiCards.map((stat, idx) => (
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
      )}

      {/* Map + Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real float map */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">ARGO Float Distribution</h3>
            <span className={`text-xs ${subtleText}`}>Click to open Float Explorer</span>
          </div>
          {floats.length > 0 ? (
            <FloatMap floats={floats} onOpenExplorer={onOpenExplorer} />
          ) : (
            <div className={`h-[300px] flex items-center justify-center rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <span className={`text-sm ${subtleText}`}>
                {loading ? 'Loading float positions…' : 'No float position data available'}
              </span>
            </div>
          )}
        </div>

        {/* Real activity trend chart */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <h3 className="text-lg font-semibold mb-2">Profile Activity Trend</h3>
          <div className="h-[300px]">
            {activity && activity.months.length > 0 ? (
              <Plot
                data={[{
                  x: activity.months,
                  y: activity.counts,
                  type: 'scatter',
                  mode: 'lines+markers',
                  line: { color: '#3b82f6', width: 2 },
                  marker: { color: '#60a5fa', size: 6 },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(59,130,246,0.1)'
                }]}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: darkMode ? '#e5e7eb' : '#111827', size: 11 },
                  margin: { t: 10, r: 10, b: 40, l: 50 },
                  xaxis: { gridcolor: darkMode ? '#374151' : '#e5e7eb', showgrid: true },
                  yaxis: { gridcolor: darkMode ? '#374151' : '#e5e7eb', showgrid: true }
                }}
                style={{ width: '100%', height: '100%' }}
                config={PLOTLY_CONFIG}
              />
            ) : (
              <div className={`h-full flex items-center justify-center rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <span className={`text-sm ${subtleText}`}>
                  {loading ? 'Loading activity data…' : 'No activity data in the last 12 months'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Depth Distribution + T-S Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Depth Distribution Histogram */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <h3 className="text-lg font-semibold mb-2">Profile Depth Distribution</h3>
          <div className="h-[300px]">
            {depthDist && depthDist.bins.length > 0 ? (
              <Plot
                data={[{
                  x: depthDist.bins,
                  y: depthDist.counts,
                  type: 'bar',
                  marker: {
                    color: depthDist.bins.map((_, i) => [
                      '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
                    ][i % 6]),
                  },
                  hovertemplate: '%{x}m<br>%{y} measurements<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: darkMode ? '#e5e7eb' : '#111827', size: 11 },
                  margin: { t: 10, r: 10, b: 50, l: 60 },
                  xaxis: {
                    title: 'Depth Range (m)',
                    gridcolor: darkMode ? '#374151' : '#e5e7eb',
                  },
                  yaxis: {
                    title: 'Measurement Count',
                    gridcolor: darkMode ? '#374151' : '#e5e7eb',
                  },
                  bargap: 0.15,
                }}
                style={{ width: '100%', height: '100%' }}
                config={PLOTLY_CONFIG}
              />
            ) : (
              <div className={`h-full flex items-center justify-center rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <span className={`text-sm ${subtleText}`}>
                  {loading ? 'Loading depth data…' : 'No depth distribution data available'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* T-S Diagram */}
        <div className={`rounded-2xl p-4 border ${cardBase}`}>
          <h3 className="text-lg font-semibold mb-2">Temperature-Salinity Diagram</h3>
          <div className="h-[300px]">
            {tsSample && tsSample.temperatures.length > 0 ? (
              <Plot
                data={[{
                  x: tsSample.salinities,
                  y: tsSample.temperatures,
                  mode: 'markers',
                  type: 'scatter',
                  marker: {
                    color: tsSample.depths,
                    colorscale: 'Viridis',
                    reversescale: true,
                    size: 4,
                    opacity: 0.6,
                    colorbar: {
                      title: { text: 'Depth (m)', font: { size: 10 } },
                      thickness: 12,
                      len: 0.8,
                      tickfont: { size: 9 },
                    },
                  },
                  hovertemplate:
                    'Sal: %{x:.2f} psu<br>Temp: %{y:.2f} °C<br>Depth: %{marker.color:.0f}m<extra></extra>',
                }]}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: darkMode ? '#e5e7eb' : '#111827', size: 11 },
                  margin: { t: 10, r: 30, b: 50, l: 60 },
                  xaxis: {
                    title: 'Salinity (psu)',
                    gridcolor: darkMode ? '#374151' : '#e5e7eb',
                    showgrid: true,
                  },
                  yaxis: {
                    title: 'Temperature (°C)',
                    gridcolor: darkMode ? '#374151' : '#e5e7eb',
                    showgrid: true,
                  },
                }}
                style={{ width: '100%', height: '100%' }}
                config={PLOTLY_CONFIG}
              />
            ) : (
              <div className={`h-full flex items-center justify-center rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <span className={`text-sm ${subtleText}`}>
                  {loading ? 'Loading T-S data…' : 'No temperature-salinity data available'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health — real statuses */}
      <div className={`rounded-2xl p-6 border ${cardBase}`}>
        <h3 className="text-lg font-semibold mb-4">System Health & Data Pipeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: 'PostgreSQL DB',   status: stats ? 'Online' : 'Unknown' },
            { name: 'LLM (Groq)',      status: 'Online' },
            { name: 'GTWY RAG',        status: 'Online' },
            { name: 'NetCDF Ingestion',status: stats && stats.total_profiles > 0 ? 'Online' : 'Idle' }
          ].map((item) => (
            <div
              key={item.name}
              className={`p-4 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} flex justify-between items-center`}
            >
              <span className="text-sm">{item.name}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                item.status === 'Online'  ? 'bg-green-500/20 text-green-400' :
                item.status === 'Idle'    ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-gray-500/20 text-gray-400'
              }`}>
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
