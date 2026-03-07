import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import { useGetTrajectoryQuery } from '../../store/apiSlice';

// Fix Leaflet default marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface FloatTrajectoryProps {
  floatId: string;
  darkMode: boolean;
}

const FloatTrajectory: React.FC<FloatTrajectoryProps> = ({ floatId, darkMode }) => {
  const { data, isLoading: loading, error: queryError } = useGetTrajectoryQuery(floatId, {
    skip: !floatId,
  });
  const points = data?.points ?? [];
  const error = queryError ? 'Failed to load trajectory data.' : '';

  const subtleText = darkMode ? 'text-gray-400' : 'text-gray-600';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className={`text-[11px] ${subtleText}`}>Loading trajectory…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className={`text-sm ${subtleText}`}>No trajectory data available for this float.</p>
      </div>
    );
  }

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);
  const centerLat = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const centerLon = positions.reduce((s, p) => s + p[1], 0) / positions.length;

  // Color gradient from start (green) to end (red)
  const getColor = (idx: number, total: number) => {
    const t = total > 1 ? idx / (total - 1) : 0;
    const r = Math.round(34 + t * (239 - 34));
    const g = Math.round(197 + t * (68 - 197));
    const b = Math.round(94 + t * (68 - 94));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden relative">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Trajectory polyline */}
        <Polyline
          positions={positions}
          pathOptions={{ color: '#3b82f6', weight: 2, opacity: 0.6, dashArray: '6 4' }}
        />
        {/* Cycle markers */}
        {points.map((pt, idx) => {
          const dateStr = pt.date ? new Date(pt.date).toISOString().slice(0, 10) : '—';
          const color = getColor(idx, points.length);
          const isFirst = idx === 0;
          const isLast = idx === points.length - 1;
          return (
            <CircleMarker
              key={pt.profile_key}
              center={[pt.latitude, pt.longitude]}
              radius={isFirst || isLast ? 7 : 4}
              pathOptions={{
                color: isFirst ? '#22c55e' : isLast ? '#ef4444' : color,
                fillColor: isFirst ? '#22c55e' : isLast ? '#ef4444' : color,
                fillOpacity: 0.9,
                weight: isFirst || isLast ? 2 : 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold">
                    {isFirst && '🟢 Start — '}
                    {isLast && '🔴 Latest — '}
                    Cycle {pt.cycle_number ?? idx + 1}
                  </div>
                  <div>{dateStr}</div>
                  <div>
                    {pt.latitude.toFixed(3)}°, {pt.longitude.toFixed(3)}°
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {/* Legend overlay */}
      <div
        className={`absolute bottom-3 left-3 rounded-lg px-3 py-2 text-[10px] shadow-lg backdrop-blur-sm ${
          darkMode ? 'bg-gray-900/80 text-gray-200 border border-gray-700' : 'bg-white/90 text-gray-800 border border-gray-200'
        }`}
      >
        <div className="font-semibold mb-1">Float {floatId} Trajectory</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Start
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Latest
          <span className="text-gray-400">· {points.length} cycles</span>
        </div>
      </div>
    </div>
  );
};

export default FloatTrajectory;
