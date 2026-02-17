// services/visualizationService.js
const { detectType } = require("../utils/visualizationDetector");
const { formatVisualization } = require("../utils/visualizationFormatter");

const build = ({ question, rows, fields, ragMeta }) => {
  if (!rows || rows.length === 0) return null;

  const type = detectType({ rows, fields, question, ragMeta });
  const data = formatVisualization(type, { rows, fields, ragMeta });

  return { type, data };
};

module.exports = { build };
