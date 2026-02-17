// src/components/visualizations/AsciiTable.tsx
import React from "react";
import { FileText, Terminal, Info } from "lucide-react";

interface AsciiTableProps {
  data: any; // { rows: [...] }
}

const AsciiTable: React.FC<AsciiTableProps> = ({ data }) => {
  // 1️⃣ Validate data
  if (!data || !data.rows || data.rows.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        No table data available.
      </div>
    );
  }

  // 2️⃣ Extract headers dynamically
  const headers = Object.keys(data.rows[0]);

  // 3️⃣ Create divider based on header count
  const divider = "-".repeat(headers.length * 12);

  // 4️⃣ Format header line
  const headerLine = headers
    .map((h) => h.toUpperCase().padEnd(12))
    .join("");

  // 5️⃣ Convert each row to aligned ASCII line
  const formatRow = (row: any) => {
    return headers
      .map((h) => String(row[h]).padEnd(12))
      .join("");
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-600/30 bg-black/40 text-xs text-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 border border-gray-600">
            <FileText className="w-3 h-3 text-emerald-300" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-[11px]">
              ASCII Tabular Summary
            </div>
            <div className="text-[10px] text-gray-400">
              Auto-generated from backend query results
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800/70 border border-gray-600/60 text-[10px] text-gray-400">
          <Terminal className="w-3 h-3" /> ASCII view
        </span>
      </div>

      {/* Table content */}
      <div className="flex-1 bg-black/70 text-emerald-100 font-mono text-[11px] p-3 overflow-auto">
        <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-400">
          <Info className="w-3 h-3" />
          <span>Automatically formatted from {data.rows.length} rows.</span>
        </div>

        <pre className="leading-relaxed">
          {headerLine}
          {"\n"}
          {divider}
          {"\n"}
          {data.rows.map((row: any, idx: number) => (
            <span key={idx}>{formatRow(row) + "\n"}</span>
          ))}
        </pre>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-600/30 bg-black/40 text-[10px] text-gray-400 flex justify-between">
        <span>Use Download CSV / NetCDF for full-resolution data.</span>
        <span className="italic">Displayed: {data.rows.length} rows</span>
      </div>
    </div>
  );
};

export default AsciiTable;
