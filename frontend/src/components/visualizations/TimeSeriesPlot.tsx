// src/components/visualizations/TimeSeriesPlot.tsx

import React from "react";
import Plot from "react-plotly.js";

interface TimeSeriesRow {
  time?: string | number | Date;
  juld?: string | number | Date;
  profile_date?: string | number | Date;
  temperature?: number;
  temperature_adjusted?: number;
  salinity?: number;
  salinity_adjusted?: number;
  value?: number;
}

interface TimeSeriesPlotProps {
  data?: {
    rows?: TimeSeriesRow[];
  };
}

const TimeSeriesPlot: React.FC<TimeSeriesPlotProps> = ({ data }) => {
  const rows = data?.rows;

  // -----------------------------
  // If backend sent real data
  // -----------------------------
  let xValues: string[] = [];
  let yValues: number[] = [];

  if (rows && rows.length > 0) {
    rows.forEach((r) => {
      const rawDate = r.juld ?? r.profile_date ?? r.time;
      const date = rawDate ? new Date(rawDate as string) : null;
      xValues.push(date ? date.toISOString().split("T")[0] : "");

      const val = r.temperature_adjusted ?? r.temperature ?? r.salinity_adjusted ?? r.salinity ?? r.value;
      if (val !== undefined) yValues.push(Number(val));
    });
    // Remove entries with no date
    const valid = xValues.map((x, i) => ({ x, y: yValues[i] })).filter(p => p.x);
    xValues = valid.map(p => p.x);
    yValues = valid.map(p => p.y);
  }

  // -----------------------------
  // Mock fallback (if no data)
  // -----------------------------
  if (xValues.length === 0) {
    xValues = [
      "2023-01-01",
      "2023-02-01",
      "2023-03-01",
      "2023-04-01",
      "2023-05-01",
      "2023-06-01",
    ];

    yValues = [26.1, 26.4, 27.0, 27.5, 28.0, 28.3];
  }

  return (
    <Plot
      data={[
        {
          x: xValues,
          y: yValues,
          mode: "lines+markers",
          name: "Time Series",
          line: {
            shape: "spline",
            width: 3,
          },
          marker: {
            size: 6,
          },
        },
      ]}
      layout={{
        title: "Time Series Plot",
        xaxis: { title: "Time" },
        yaxis: { title: "Value" },
        margin: { t: 40, r: 20, b: 50, l: 60 },
      }}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true }}
    />
  );
};

export default TimeSeriesPlot;
