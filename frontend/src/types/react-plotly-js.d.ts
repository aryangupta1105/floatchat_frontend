// src/types/react-plotly-js.d.ts
declare module "react-plotly.js" {
  import * as React from "react";

  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    className?: string;
    onClick?: (event: any) => void;
    onSelected?: (event: any) => void;
  }

  const Plot: React.FC<PlotParams>;
  export default Plot;
}
