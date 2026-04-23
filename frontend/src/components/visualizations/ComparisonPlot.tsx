// src/components/visualizations/ComparisonPlot.tsx

import React from "react";
import Plot from "react-plotly.js";

interface ComparisonRow {
  depth: number;
  profileA?: number;
  profileB?: number;
}

interface ComparisonProps {
  data?: {
    rows?: ComparisonRow[];
  };
}

const ComparisonPlot: React.FC<ComparisonProps> = ({ data }) => {
  const rows = data?.rows;

  let depth: number[] = [];
  let A: number[] = [];
  let B: number[] = [];

  if (rows?.length) {
    rows.forEach((r) => {
      depth.push(r.depth);
      A.push(r.profileA ?? 0);
      B.push(r.profileB ?? 0);
    });
  } else {
    // Mock fallback
    depth = [0, 50, 100, 200, 500, 1000];
    A = [28, 26, 24, 18, 8, 4];
    B = [29, 27, 25, 19, 9, 5];
  }

  return (
    <Plot
      data={[
        {
          x: A,
          y: depth,
          mode: "lines+markers",
          name: "Profile A",
          line: { shape: "spline", width: 3 }
        },
        {
          x: B,
          y: depth,
          mode: "lines+markers",
          name: "Profile B",
          line: { shape: "spline", width: 3 }
        }
      ]}
      layout={{
        title: "Comparison of Profiles",
        xaxis: { title: "Value" },
        yaxis: { title: "Depth (m)", autorange: "reversed" },
        legend: { x: 0.7, y: 1 },
        margin: { t: 40, r: 20, b: 50, l: 60 }
      }}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true }}
    />
  );
};

export default ComparisonPlot;
