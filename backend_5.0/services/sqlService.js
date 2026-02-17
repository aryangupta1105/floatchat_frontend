// services/sqlService.js
const { query } = require("../config/db");
const { ensureSafeSelect } = require("../utils/sqlValidator");

const execute = async (sql, params = []) => {
  ensureSafeSelect(sql);
  
  // Remove trailing semicolon if present (PostgreSQL client doesn't need it)
  const cleanSql = sql.trim().endsWith(";") ? sql.trim().slice(0, -1) : sql;
  
  const res = await query(cleanSql, params);
  return {
    rows: res.rows,
    rowCount: res.rowCount,
    fields: res.fields // contains column names etc.
  };
};

module.exports = {
  execute
};
