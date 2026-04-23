// src/components/visualizations/ProfilePlot.tsx

import React from "react";
import Plot from "react-plotly.js";

interface ProfileRow {
  depth?: number;
  pressure?: number;
  temperature?: number;
  temperature_adjusted?: number;
  salinity?: number;
  salinity_adjusted?: number;
  value?: number;
  profile_key?: string;
  profile_date?: string;
  juld?: string;
  platform_number?: string;
}

interface ProfilePlotProps {
  data?: {
    rows?: ProfileRow[];
  };
}

const ProfilePlot: React.FC<ProfilePlotProps> = ({ data }) => {
  const rows = data?.rows;

  // No data at all — show mock
  if (!rows || rows.length === 0) {
    return (
      <Plot
        data={[{ x: [28,27,25,20,10,5], y: [0,50,100,200,500,1000],
          mode: "lines+markers", name: "Sample profile",
          line: { shape: "spline", width: 3 }, marker: { size: 6 } }]}
        layout={{ title: "Sample Profile (no data)",
          xaxis: { title: "Temperature (°C)" },
          yaxis: { title: "Depth (m)", autorange: "reversed" },
          margin: { t: 40, r: 20, b: 50, l: 60 } }}
        style={{ width: "100%", height: "100%" }}
        config={{ responsive: true }}
      />
    );
  }

  // Check if rows actually have depth data
  const hasDepth = rows.some(r => r.depth != null && Number(r.depth) > 0);

  if (!hasDepth) {
    // Rows exist but no depth column — wrong query type (probably a map/location query)
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="text-4xl">📊</div>
        <p className="text-sm font-semibold text-yellow-400">No depth data in this result</p>
        <p className="text-xs text-gray-400">
          The query returned {rows.length} rows but they don't contain depth/pressure levels.<br/>
          Try asking: <span className="text-blue-400 font-mono">"show temperature profile for float 1900064"</span>
        </p>
        <p className="text-xs text-gray-500">Columns found: {Object.keys(rows[0]).join(", ")}</p>
      </div>
    );
  }

  // Group by profile_key to draw one trace per profile dive
  const profileMap = new Map<string, { depth: number[]; values: number[]; label: string }>();

  rows.forEach((r) => {
    const key = r.profile_key || r.profile_date || r.juld || "profile";
    const dateStr = (r.profile_date || r.juld)
      ? new Date(r.profile_date || r.juld || "").toISOString().slice(0, 10)
      : "";
    const label = `${r.platform_number || "Float"} ${dateStr}`;

    if (!profileMap.has(key)) profileMap.set(key, { depth: [], values: [], label });
    const p = profileMap.get(key)!;

    const d = Number(r.depth ?? r.pressure ?? 0);
    const v = Number(r.temperature_adjusted ?? r.temperature ?? r.salinity_adjusted ?? r.salinity ?? r.value ?? 0);
    p.depth.push(d);
    p.values.push(v);
  });

  // Detect parameter label from first row
  const firstRow = rows[0];
  const paramLabel = firstRow.temperature_adjusted != null || firstRow.temperature != null
    ? "Temperature (°C)"
    : firstRow.salinity_adjusted != null || firstRow.salinity != null
    ? "Salinity (PSU)"
    : "Value";

  // Build one Plotly trace per profile (max 10 traces to avoid clutter)
  const traces = Array.from(profileMap.entries()).slice(0, 10).map(([, p]) => ({
    x: p.values,
    y: p.depth,
    mode: "lines+markers" as const,
    name: p.label,
    line: { shape: "spline" as const, width: 2 },
    marker: { size: 4 }
  }));

  return (
    <Plot
      data={traces}
      layout={{
        title: `Vertical Profile — ${paramLabel}`,
        xaxis: { title: paramLabel },
        yaxis: { title: "Depth (m)", autorange: "reversed" },
        legend: { orientation: "h", y: -0.2 },
        margin: { t: 40, r: 20, b: 80, l: 60 }
      }}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true }}
    />
  );
};

export default ProfilePlot;
