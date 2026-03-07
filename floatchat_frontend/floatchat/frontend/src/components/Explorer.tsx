import 'leaflet/dist/leaflet.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import Plot from 'react-plotly.js';
import { apiSlice, useGetFloatsQuery } from '../store/apiSlice';
import FloatTrajectory from './visualizations/FloatTrajectory';

interface ExplorerProps {
  darkMode: boolean;
}

// region -> map center
const REGION_CENTERS: Record<string, [number, number]> = {
  global: [0, 0],
  indian_ocean: [0, 80],
  arabian_sea: [15, 65],
  bay_of_bengal: [15, 90]
};

// Helper to normalize /api/floats response
const normalizeFloatsResponse = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.floats)) return data.floats;
  if (Array.isArray(data?.results)) return data.results;

  console.warn('Unexpected /api/floats response shape:', data);
  return [];
};

const Explorer: React.FC<ExplorerProps> = ({ darkMode }) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Filter state
  const [region, setRegion] = useState('indian_ocean');
  const [parameter, setParameter] = useState<'temperature' | 'salinity'>('temperature');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState(todayStr);
  const [minDepth, setMinDepth] = useState<number>(0);
  const [maxDepth, setMaxDepth] = useState<number>(2000);

  // RTK Query: seed floats from cache (same cache Dashboard uses), lazy queries for on-demand
  const { data: cachedFloats = [] } = useGetFloatsQuery();
  const [triggerFetchFloats, floatsQuery] = apiSlice.useLazyGetFloatsQuery();
  const [triggerFetchProfiles, profilesQuery] = apiSlice.useLazyGetProfilesQuery();

  // Data state
  const [floats, setFloats] = useState<any[]>([]);
  const [selectedFloat, setSelectedFloat] = useState<any | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);

  // Loading / error
  const loadingFloats = floatsQuery.isFetching;
  const loadingProfile = profilesQuery.isFetching;
  const [error, setError] = useState('');

  // Manual search state
  const [searchId, setSearchId] = useState('');
  const [searchError, setSearchError] = useState('');

  // Visualization tab: 'profile' | 'trajectory' | 'ts'
  const [vizTab, setVizTab] = useState<'profile' | 'trajectory' | 'ts'>('profile');

  // Has the user clicked Apply Filters or Search yet?
  const [hasInteracted, setHasInteracted] = useState(false);

  const mapCenter = REGION_CENTERS[region] || REGION_CENTERS.global;
  const isFloatList = Array.isArray(floats);

  const parameterLabel =
    parameter === 'temperature'
      ? 'Temperature (°C)'
      : parameter === 'salinity'
      ? 'Salinity (psu)'
      : (parameter as string).charAt(0).toUpperCase() + (parameter as string).slice(1);

  // Fetch PROFILES for a specific float (RTK Query lazy)
  const fetchProfilesForFloat = useCallback(async (floatObj: any) => {
    if (!floatObj) return;
    setError('');
    setSelectedFloat(floatObj);
    try {
      const result = await triggerFetchProfiles({
        float_id: floatObj.float_id,
        parameter,
        start_date: startDate,
        end_date: endDate,
        min_depth: minDepth,
        max_depth: maxDepth
      }).unwrap();
      setProfileData(result || null);
    } catch {
      setError('Failed to load profiles for this float.');
      setProfileData(null);
    }
  }, [triggerFetchProfiles, parameter, startDate, endDate, minDepth, maxDepth]);

  // Fetch FLOATS list based on filters (RTK Query lazy)
  const fetchFloats = useCallback(async (triggerProfiles = false) => {
    setError('');
    setSearchError('');
    try {
      const result = await triggerFetchFloats({
        region,
        parameter,
        start_date: startDate,
        end_date: endDate,
        min_depth: minDepth,
        max_depth: maxDepth
      }).unwrap();
      const normalized = Array.isArray(result) ? result : [];
      setFloats(normalized);

      if (triggerProfiles && normalized.length > 0) {
        await fetchProfilesForFloat(normalized[0]);
      } else {
        setSelectedFloat(null);
        setProfileData(null);
      }
    } catch {
      setError('Failed to load floats. Please try again.');
      setFloats([]);
      setSelectedFloat(null);
      setProfileData(null);
    }
  }, [triggerFetchFloats, fetchProfilesForFloat, region, parameter, startDate, endDate, minDepth, maxDepth]);

  // Manual search handler
  const handleSearchFloat = async () => {
    const trimmed = searchId.trim();
    if (!trimmed) {
      setSearchError('Enter a float ID to search.');
      return;
    }

    if (!isFloatList || floats.length === 0) {
      await fetchFloats(false);
    }

    const list = Array.isArray(floats) ? floats : [];
    if (list.length === 0) {
      setSearchError('No floats found for current filters.');
      return;
    }

    const found = list.find(
      (f: any) =>
        String(f.float_id) === trimmed ||
        String(f.float_id) === String(Number(trimmed))
    );

    if (!found) {
      setSearchError('Float not found in current filters.');
      return;
    }

    setSearchError('');
    setHasInteracted(true);
    await fetchProfilesForFloat(found);
  };

  // Seed local floats from RTK Query cache on mount (same cache Dashboard uses)
  useEffect(() => {
    if (cachedFloats.length > 0 && floats.length === 0) {
      setFloats(cachedFloats as any[]);
    }
  }, [cachedFloats]);

  // Build traces for profile plot (memoized)
  const profileTraces = useMemo(() => {
    if (!profileData || !Array.isArray(profileData.profiles)) return [];
    return profileData.profiles.map((profile: any) => ({
      x: profile.values,
      y: profile.depths,
      mode: 'lines+markers',
      name: profile.label || 'profile',
      line: { shape: 'spline' }
    }));
  }, [profileData]);

  // Stable Plotly config + style objects (avoids re-creating on every render)
  const plotlyConfig = useMemo(() => ({ responsive: true, displayModeBar: false } as const), []);
  const plotlyStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);

  const profileLayout = useMemo(() => ({
    title: '',
    xaxis: { title: parameterLabel, zeroline: false },
    yaxis: { title: 'Depth (m)', autorange: 'reversed' as const, zeroline: false },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: darkMode ? '#e5e7eb' : '#111827', size: 10 },
    margin: { t: 20, r: 20, b: 40, l: 50 },
    legend: { orientation: 'h' as const, x: 0, y: 1.1, font: { size: 9 } }
  }), [darkMode, parameterLabel]);

  const tsLayout = useMemo(() => ({
    title: '',
    xaxis: { title: 'Salinity (psu)', zeroline: false },
    yaxis: { title: 'Temperature (\u00b0C)', zeroline: false },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: darkMode ? '#e5e7eb' : '#111827', size: 10 },
    margin: { t: 20, r: 30, b: 40, l: 50 },
    showlegend: false,
  }), [darkMode]);

  // Memoize T-S traces
  const tsTraces = useMemo(() => {
    if (!profileData?.profiles?.length) return [];
    return profileData.profiles.map((p: any, i: number) => ({
      x: p.salinities?.filter((_: any, j: number) => p.temperatures?.[j] != null) || [],
      y: p.temperatures?.filter((t: any) => t != null) || [],
      mode: 'markers',
      type: 'scatter' as const,
      name: p.label || `Profile ${i + 1}`,
      marker: {
        size: 4,
        opacity: 0.7,
        color: p.depths?.filter((_: any, j: number) => p.temperatures?.[j] != null) || [],
        colorscale: 'Viridis',
        reversescale: true,
        ...(i === 0 ? {
          colorbar: {
            title: { text: 'Depth (m)', font: { size: 9 } },
            thickness: 10,
            len: 0.7,
            tickfont: { size: 8 },
          }
        } : {}),
      },
      hovertemplate: 'Sal: %{x:.2f}<br>Temp: %{y:.2f} \u00b0C<extra>' + (p.label || '') + '</extra>',
    }));
  }, [profileData]);

  // Shared color classes for dark / light mode
  const cardBase =
    darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900';
  const subCardBase =
    darkMode ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-900';
  const subtleText = darkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`rounded-2xl shadow-xl border ${cardBase} flex h-[600px]`}>
      {/* LEFT PANEL – filters + search + float list */}
      <div
        className={`w-80 border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex flex-col overflow-y-auto`}
      >
        {/* Header */}
        <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              FE
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Float Explorer</h1>
              <p className={`text-[11px] ${subtleText}`}>
                Discover and inspect ARGO float profiles interactively.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Filters card */}
          <div className={`rounded-xl border ${subCardBase} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em]">
                Filters
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500 border border-blue-500/30">
                Ocean Region
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium">
                  Region
                  <select
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="indian_ocean">Indian Ocean</option>
                    <option value="arabian_sea">Arabian Sea</option>
                    <option value="bay_of_bengal">Bay of Bengal</option>
                    <option value="global">Global</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block font-medium">
                  Parameter
                  <select
                    value={parameter}
                    onChange={e => setParameter(e.target.value as any)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="temperature">Temperature</option>
                    <option value="salinity">Salinity</option>
                  </select>
                </label>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 font-medium">
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </label>
                <label className="flex-1 font-medium">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 font-medium">
                  Min depth (m)
                  <input
                    type="number"
                    value={minDepth}
                    onChange={e => setMinDepth(Number(e.target.value) || 0)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </label>
                <label className="flex-1 font-medium">
                  Max depth (m)
                  <input
                    type="number"
                    value={maxDepth}
                    onChange={e => setMaxDepth(Number(e.target.value) || 0)}
                    className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      darkMode
                        ? 'bg-gray-900 border-gray-700 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </label>
              </div>

              <button
                onClick={async () => {
                  setHasInteracted(true);
                  await fetchFloats(true);
                }}
                disabled={loadingFloats}
                className={`mt-1 w-full rounded-lg px-3 py-2 text-xs font-semibold shadow transition ${
                  loadingFloats
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:shadow-md'
                } ${
                  darkMode
                    ? 'bg-blue-500 text-white hover:bg-blue-400'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {loadingFloats ? 'Loading floats…' : 'Apply filters'}
              </button>

              {error && (
                <p className={`text-[11px] mt-1 text-red-400`}>{error}</p>
              )}
            </div>
          </div>

          {/* Search card */}
          <div className={`rounded-xl border ${subCardBase} p-3`}>
            <div className="flex items-center justify-between mb-2 text-xs">
              <h2 className="font-semibold uppercase tracking-[0.14em]">
                Search Float
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/40">
                Float ID
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Dropdown — populated from loaded floats */}
              {floats.length > 0 && (
                <select
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                    darkMode
                      ? 'bg-gray-900 border-gray-700 text-gray-100'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">— Select a float ID —</option>
                  {floats.map((f: any) => (
                    <option key={f.float_id} value={String(f.float_id)}>
                      {f.float_id}{f.last_profile_date ? ` · ${f.last_profile_date.slice(0,10)}` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Manual text input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchFloat()}
                  placeholder={loadingFloats ? 'Loading floats…' : 'e.g. 1900064'}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                    darkMode
                      ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSearchFloat}
                  disabled={!searchId.trim()}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    darkMode
                      ? 'bg-emerald-500 text-gray-900 hover:bg-emerald-400'
                      : 'bg-emerald-500 text-white hover:bg-emerald-400'
                  }`}
                >
                  Go
                </button>
              </div>
            </div>
            {searchError && (
              <p className="mt-1 text-[11px] text-red-400">{searchError}</p>
            )}
          </div>

          {/* Floats list – only after interaction */}
          {hasInteracted && (
            <div className={`rounded-xl border ${subCardBase} p-3 flex-1 flex flex-col`}>
              <div className="flex items-center justify-between mb-2 text-xs">
                <h2 className="font-semibold">Floats</h2>
                <span className={subtleText}>
                  {isFloatList ? floats.length : 0} found
                </span>
              </div>
              <div
                className={`relative max-h-64 overflow-y-auto rounded-lg border ${
                  darkMode ? 'border-gray-700 bg-gray-950/60' : 'border-gray-200 bg-white'
                }`}
              >
                <table className="min-w-full text-[11px]">
                  <thead
                    className={`sticky top-0 ${
                      darkMode ? 'bg-gray-900/95' : 'bg-gray-50'
                    }`}
                  >
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">ID</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Last profile
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!isFloatList || floats.length === 0) && (
                      <tr>
                        <td
                          colSpan={2}
                          className={`px-3 py-4 text-center text-[11px] ${subtleText}`}
                        >
                          No floats found for current filters.
                        </td>
                      </tr>
                    )}
                    {isFloatList &&
                      floats.map((f: any, idx: number) => {
                        const isSelected =
                          selectedFloat && selectedFloat.float_id === f.float_id;
                        return (
                          <tr
                            key={f.float_id}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? darkMode
                                  ? 'bg-blue-500/20'
                                  : 'bg-blue-100'
                                : idx % 2 === 0
                                ? darkMode
                                  ? 'bg-gray-950/40'
                                  : 'bg-white'
                                : darkMode
                                  ? 'bg-gray-900/40'
                                  : 'bg-gray-50'
                            }`}
                            onClick={() => {
                              setHasInteracted(true);
                              fetchProfilesForFloat(f);
                            }}
                          >
                            <td className="px-3 py-2">{f.float_id}</td>
                            <td className="px-3 py-2">
                              {f.last_profile_date || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL – map + profiles */}
      <div className="flex flex-1 flex-col">
        {/* Map (always visible) */}
        <div
          className={`relative ${
            hasInteracted ? 'flex-[1.1] border-b' : 'flex-1 border-b'
          } ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <MapContainer
            center={mapCenter}
            zoom={3}
            style={{ width: '100%', height: '100%' }}
            className="rounded-tr-2xl"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Float markers – only after interaction */}
            {hasInteracted &&
              isFloatList &&
              floats.map((f: any) => {
                const lat = f.lat ?? f.latitude;
                const lon = f.lon ?? f.longitude;
                if (lat == null || lon == null) return null;

                return (
                  <Marker key={f.float_id} position={[lat, lon]}>
                    <Popup>
                      <div className="text-xs">
                        <strong>Float {f.float_id}</strong>
                        <br />
                        Lat: {lat.toFixed(2)}, Lon: {lon.toFixed(2)}
                        <br />
                        Last profile: {f.last_profile_date || '-'}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>

          {/* Overlay chips */}
          <div className="absolute left-4 top-4 flex flex-col gap-2 text-[11px]">
            <div
              className={`inline-flex items-center rounded-full px-3 py-1 shadow ${
                darkMode
                  ? 'bg-gray-900/80 border border-gray-700 text-gray-100'
                  : 'bg-white/90 border border-gray-200 text-gray-800'
              }`}
            >
              Region:&nbsp;
              <span className="font-semibold capitalize">
                {region.replace(/_/g, ' ')}
              </span>
            </div>
            <div
              className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] ${
                darkMode
                  ? 'bg-gray-900/80 border-gray-700 text-gray-200'
                  : 'bg-white/90 border-gray-300 text-gray-700'
              }`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 mr-1" />
              ARGO float position
            </div>
          </div>
        </div>

        {/* Profiles – only after interaction */}
        {hasInteracted && (
          <div className="flex-1 p-4">
            <div
              className={`h-full rounded-2xl border shadow-inner flex flex-col ${
                darkMode
                  ? 'bg-gray-900 border-gray-700 text-gray-100'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              {/* Visualization tabs */}
              <div
                className={`flex items-center gap-0 px-4 pt-2 border-b ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                {[
                  { id: 'profile' as const, label: 'Depth Profile' },
                  { id: 'trajectory' as const, label: 'Trajectory Map' },
                  { id: 'ts' as const, label: 'T-S Diagram' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVizTab(tab.id)}
                    className={`px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                      vizTab === tab.id
                        ? 'border-blue-500 text-blue-500'
                        : `border-transparent ${
                            darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-900'
                          }`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="flex-1" />
                {loadingProfile && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 pr-1">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    Loading…
                  </span>
                )}
              </div>

              <div className="flex-1 p-3">
                {/* PROFILE TAB */}
                {vizTab === 'profile' && (
                  <>
                    {!loadingProfile && !selectedFloat && (
                      <div className="h-full flex items-center justify-center">
                        <p className={`text-[12px] text-center max-w-xs ${subtleText}`}>
                          Choose a float from the table or map, or search by ID to
                          see vertical profiles of{' '}
                          <span className="font-semibold">{parameterLabel}</span>.
                        </p>
                      </div>
                    )}

                    {!loadingProfile && selectedFloat && profileData && (
                      <div className="h-full">
                        <Plot
                          data={profileTraces}
                          layout={profileLayout}
                          style={plotlyStyle}
                          config={plotlyConfig}
                        />
                      </div>
                    )}

                    {!loadingProfile && selectedFloat && !profileData && (
                      <div className="h-full flex items-center justify-center">
                        <p className={`text-[12px] ${subtleText}`}>
                          No profile data returned for this float in the selected filters.
                        </p>
                      </div>
                    )}

                    {loadingProfile && (
                      <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                          <p className={`text-[11px] ${subtleText}`}>
                            Fetching profile curves…
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* TRAJECTORY TAB */}
                {vizTab === 'trajectory' && (
                  <>
                    {selectedFloat ? (
                      <FloatTrajectory floatId={selectedFloat.float_id} darkMode={darkMode} />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className={`text-[12px] text-center max-w-xs ${subtleText}`}>
                          Select a float to see its trajectory across ocean cycles.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* T-S DIAGRAM TAB */}
                {vizTab === 'ts' && (
                  <>
                    {!loadingProfile && selectedFloat && profileData && profileData.profiles?.length > 0 ? (
                      <div className="h-full">
                        <Plot
                          data={tsTraces}
                          layout={tsLayout}
                          style={plotlyStyle}
                          config={plotlyConfig}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className={`text-[12px] text-center max-w-xs ${subtleText}`}>
                          {selectedFloat
                            ? 'Load profiles first (via Depth Profile tab) to view the T-S diagram.'
                            : 'Select a float to see its Temperature-Salinity diagram.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explorer;
