// src/components/visualizations/ProfilePlot.tsx

import React from "react";
import Plot from "react-plotly.js";

interface ProfileRow {
  depth: number;
  temperature?: number;
  salinity?: number;
  value?: number;
}

interface ProfilePlotProps {
  data?: {
    rows?: ProfileRow[];
  };
}

const ProfilePlot: React.FC<ProfilePlotProps> = ({ data }) => {
  const rows = data?.rows;

  let depth: number[] = [];
  let values: number[] = [];

  if (rows?.length) {
    rows.forEach((r) => {
      depth.push(r.depth);
      values.push(r.temperature ?? r.salinity ?? r.value ?? 0);
    });
  } else {
    // Mock fallback
    depth = [0, 50, 100, 200, 500, 1000];
    values = [28, 27, 25, 20, 10, 5];
  }

  return (
    <Plot
      data={[
        {
          x: values,
          y: depth,
          mode: "lines+markers",
          line: { shape: "spline", width: 3 },
          marker: { size: 6 }
        }
      ]}
      layout={{
        title: "Vertical Profile (Depth vs Parameter)",
        xaxis: { title: "Value" },
        yaxis: { title: "Depth (m)", autorange: "reversed" },
        margin: { t: 40, r: 20, b: 50, l: 60 }
      }}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true }}
    />
  );
};

export default ProfilePlot;
