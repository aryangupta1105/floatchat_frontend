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

  const MAX_WIDTH = 18;

  // format cell with truncation
  const formatCell = (value: any, width: number) => {
    const str = String(value ?? "");
    if (str.length > width) {
      return str.slice(0, width - 1) + "…";
    }
    return str.padEnd(width);
  };

  // calculate widths
  const columnWidths = headers.map((header) => {
    const maxLen = Math.max(
      header.length,
      ...data.rows.map((row: any) =>
        String(row[header] ?? "").length
      )
    );
    return Math.min(maxLen + 2, MAX_WIDTH);
  });

  // header
  const headerLine = headers
    .map((h, i) => formatCell(h.toUpperCase(), columnWidths[i]))
    .join(" │ ");

  // divider
  const divider = columnWidths
    .map((w) => "─".repeat(w))
    .join("─┼─");

  // rows
  const formatRow = (row: any) => {
    return headers
      .map((h, i) => formatCell(row[h], columnWidths[i]))
      .join(" │ ");
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-600/30 bg-black/40 text-xs text-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 border border-gray-600">
            <FileText className="w-3 h-3 text-emerald-300" />
          </div>
          <div>
            <div className="font-semibold text-[11px]">ASCII Tabular Summary</div>
            <div className="text-[10px] text-gray-400">
              Auto-generated from backend query results
            </div>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800 border border-gray-600 text-[10px]">
          <Terminal className="w-3 h-3" /> ASCII
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 bg-black/80 text-emerald-200 font-mono text-[11px] p-3 overflow-auto">
        <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-400">
          <Info className="w-3 h-3" />
          <span>{data.rows.length} rows</span>
        </div>

        <pre className="leading-relaxed whitespace-pre">
          {headerLine}
          {"\n"}
          {divider}
          {"\n"}
          {data.rows.map((row: any, i: number) => (
            <span key={i}>{formatRow(row) + "\n"}</span>
          ))}
        </pre>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-600/30 bg-black/40 text-[10px] text-gray-400 flex justify-between">
        <span>Download CSV for full data</span>
        <span>{data.rows.length} rows</span>
      </div>
    </div>
  );
};

export default AsciiTable;
