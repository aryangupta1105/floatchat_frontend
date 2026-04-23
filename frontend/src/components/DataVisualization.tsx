import { motion } from 'framer-motion';
import { BarChart3, Droplets, MapPin, Thermometer, Waves, X } from 'lucide-react';
import React from 'react';
import Plot from 'react-plotly.js';
import { VisualizationOptions } from './ChatInterface';

import AsciiTable from './visualizations/AsciiTable';
import ComparisonPlot from './visualizations/ComparisonPlot';
import FloatTrajectory from './visualizations/FloatTrajectory';
import ProfilePlot from './visualizations/ProfilePlot';
import SpatialMap from './visualizations/SpatialMap';
import TimeSeriesPlot from './visualizations/TimeSeriesPlot';

interface DataVisualizationProps {
  darkMode: boolean;
  vizOptions: VisualizationOptions | null;
  onClose?: () => void;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ darkMode, vizOptions, onClose }) => {
  // Decide what to render
  const renderContent = () => {
    if (!vizOptions) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-blue-500/60" />
          </div>
          <div>
            <p className={`text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Visualization Workspace
            </p>
            <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Send a query in FloatChat, then click 
              <span className="font-medium text-blue-400">View on map</span>, 
              <span className="font-medium text-emerald-400">Plot profiles</span>, or 
              <span className="font-medium text-purple-400">T-S Diagram</span>
               to render charts here.
            </p>
          </div>
        </div>
      );
    }

    switch (vizOptions.type) {
      case 'map':
        return <SpatialMap data={vizOptions.sourceMessage.data} />;

      case 'profile':
        return <ProfilePlot data={vizOptions.sourceMessage.data} />;

      case 'timeseries':
        return <TimeSeriesPlot data={vizOptions.sourceMessage.data} />;

      case 'comparison':
        return <ComparisonPlot data={vizOptions.sourceMessage.data} />;

      case 'table':
        return <AsciiTable data={vizOptions.sourceMessage.data} />;

      case 'trajectory': {
        const rows = vizOptions.sourceMessage.data?.rows;
        const floatId = rows?.[0]?.platform_number || rows?.[0]?.float_id || '';
        if (!floatId) {
          return (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                darkMode ? 'bg-cyan-500/10' : 'bg-cyan-100'
              }`}>
                <MapPin className="w-6 h-6 text-cyan-500/60" />
              </div>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Trajectory requires a specific float
              </p>
              <p className={`text-xs leading-relaxed max-w-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Try asking for float-specific data, e.g.{' '}
                <span className="font-medium text-cyan-400">"show data for float 2902266"</span>{' '}
                then click Float Trajectory.
              </p>
            </div>
          );
        }
        return <FloatTrajectory floatId={floatId} darkMode={darkMode} />;
      }

      case 'ts': {
        const tsRows = vizOptions.sourceMessage.data?.rows;
        if (!tsRows?.length) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              No temperature/salinity data available in this message.
            </div>
          );
        }
        const points = tsRows
          .map((r: any) => {
            const temp = Number(r.temperature_adjusted ?? r.temperature);
            const sal = Number(r.salinity_adjusted ?? r.salinity);
            const depthRaw = r.depth;
            const depth = depthRaw == null ? null : Number(depthRaw);
            if (!Number.isFinite(temp) || !Number.isFinite(sal)) {
              return null;
            }
            return {
              temp,
              sal,
              depth: Number.isFinite(depth) ? depth : null,
            };
          })
          .filter((p: any) => p != null);

        if (points.length === 0) {
          return (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Temperature-salinity values are missing or invalid for this dataset.
            </div>
          );
        }

        const temps = points.map((p: any) => p.temp);
        const sals = points.map((p: any) => p.sal);
        const hasDepthValues = points.some((p: any) => p.depth != null);
        const depths = points.map((p: any) => (p.depth == null ? 0 : p.depth));

        return (
          <Plot
            data={[{
              x: sals,
              y: temps,
              mode: 'markers',
              type: 'scatter',
              marker: {
                color: hasDepthValues ? depths : '#3b82f6',
                colorscale: 'Viridis',
                reversescale: true,
                size: 5,
                opacity: 0.7,
                ...(hasDepthValues ? {
                  colorbar: {
                    title: { text: 'Depth (m)', font: { size: 10 } },
                    thickness: 12,
                    len: 0.8,
                    tickfont: { size: 9 },
                  }
                } : {}),
              },
              hovertemplate: 'Sal: %{x:.2f} psu<br>Temp: %{y:.2f} \u00b0C<extra></extra>',
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
                title: 'Temperature (\u00b0C)',
                gridcolor: darkMode ? '#374151' : '#e5e7eb',
                showgrid: true,
              },
            }}
            style={{ width: '100%', height: '100%' }}
            config={{ displayModeBar: false, responsive: true }}
          />
        );
      }

      default:
        return null;
    }
  };

  const titleByType: Record<string, string> = {
    map: 'Spatial View – ARGO Floats',
    profile: 'Vertical Profile – Depth vs Parameter',
    timeseries: 'Time Series – Parameter Evolution',
    comparison: 'Comparison – Multiple Profiles/Floats',
    table: 'ASCII / Tabular Summaries',
    trajectory: 'Float Trajectory – Cycle Movement',
    ts: 'Temperature-Salinity Diagram'
  };

  const subtitleByType: Record<string, string> = {
    map: 'Spatial distribution of ARGO floats on an interactive map.',
    profile: 'Depth-resolved vertical profile from your database.',
    timeseries: 'Parameter evolution over time for a region.',
    comparison: 'Side-by-side comparison of multiple profiles.',
    table: 'Tabular view of cycle/depth/parameter values.',
    trajectory: 'Float movement across cycles shown on an interactive map.',
    ts: 'Temperature vs Salinity scatter colored by depth.'
  };

  const currentType = vizOptions?.type ?? 'map';

  return (
    <div className="h-full flex flex-col">
      {/* ── Workspace Header ── */}
      <div
        className={`flex-shrink-0 flex items-center justify-between px-5 py-3 border-b ${
          darkMode ? 'border-gray-700/60' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              darkMode ? 'bg-blue-500/15' : 'bg-blue-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {vizOptions ? titleByType[currentType] : 'Visualization Workspace'}
            </h2>
            <p className={`text-xs leading-tight ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {vizOptions ? subtitleByType[currentType] : 'Charts appear here'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend chips — only when viz is active */}
          {vizOptions && (
            <div className="hidden md:flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-400" />
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Region</span>
              </div>
              <div className="flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-red-400" />
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Temp</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-sky-400" />
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Salinity</span>
              </div>
              <div className="flex items-center gap-1">
                <Waves className="w-3 h-3 text-emerald-400" />
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Profiles</span>
              </div>
            </div>
          )}

          {onClose && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                darkMode
                  ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'
              }`}
              title={vizOptions ? "Clear visualization" : "Close workspace"}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Chart Canvas — the primary workspace ── */}
      <div
        className={`flex-1 min-h-0 ${
          darkMode ? 'bg-gray-950' : 'bg-gray-50'
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default DataVisualization;
