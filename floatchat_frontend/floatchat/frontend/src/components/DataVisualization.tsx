import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MapPin, TrendingUp, Waves, Thermometer, Droplets } from 'lucide-react';
import { VisualizationOptions } from './ChatInterface';

import SpatialMap from './visualizations/SpatialMap';
import ProfilePlot from './visualizations/ProfilePlot';
import TimeSeriesPlot from './visualizations/TimeSeriesPlot';
import ComparisonPlot from './visualizations/ComparisonPlot';
import AsciiTable from './visualizations/AsciiTable';

interface DataVisualizationProps {
  darkMode: boolean;
  vizOptions: VisualizationOptions | null;
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ darkMode, vizOptions }) => {
  // Decide what to render
  const renderContent = () => {
    if (!vizOptions) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center text-sm">
          <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
            Data visualizations will appear here when you choose an action
            like <span className="font-semibold text-blue-500">“View on map”</span> or
            <span className="font-semibold text-emerald-500"> “Plot profiles”</span> from FloatChat.
          </p>
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

      default:
        return null;
    }
  };

  const titleByType: Record<string, string> = {
    map: 'Spatial View – ARGO Floats',
    profile: 'Vertical Profile – Depth vs Parameter',
    timeseries: 'Time Series – Parameter Evolution',
    comparison: 'Comparison – Multiple Profiles/Floats',
    table: 'ASCII / Tabular Summaries'
  };

  const subtitleByType: Record<string, string> = {
    map: 'Mock spatial distribution of ARGO floats using Leaflet.',
    profile: 'Mock salinity profile using depth vs salinity.',
    timeseries: 'Mock SST evolution over time for a region.',
    comparison: 'Mock comparison of two temperature profiles.',
    table: 'Mock ASCII view of cycle/depth/parameter values.'
  };

  const currentType = vizOptions?.type ?? 'map';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`rounded-2xl p-4 ${
        darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      } shadow-xl h-[600px] flex flex-col`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              darkMode ? 'bg-blue-900/60' : 'bg-blue-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {titleByType[currentType]}
            </h2>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {subtitleByType[currentType]}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <div className="flex items-center space-x-1">
            <MapPin className="w-3 h-3 text-blue-400" />
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>ARGO region</span>
          </div>
          <div className="flex items-center space-x-1">
            <Thermometer className="w-3 h-3 text-red-400" />
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Temp</span>
          </div>
          <div className="flex items-center space-x-1">
            <Droplets className="w-3 h-3 text-sky-400" />
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Salinity</span>
          </div>
          <div className="flex items-center space-x-1">
            <Waves className="w-3 h-3 text-emerald-400" />
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Profiles</span>
          </div>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 min-h-0 mt-2 rounded-xl overflow-hidden border border-dashed
        border-gray-600/40 bg-gray-900/10">
        {renderContent()}
      </div>
    </motion.div>
  );
};

export default DataVisualization;
