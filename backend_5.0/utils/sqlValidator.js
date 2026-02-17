// utils/sqlValidator.js
const { SqlValidationError } = require("./error");

// Very conservative guard for generated SQL.
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "TRUNCATE",
  "ALTER",
  "CREATE",
  "GRANT",
  "REVOKE"
];

const ensureSafeSelect = (sql) => {
  if (!sql || typeof sql !== "string") {
    throw new SqlValidationError("SQL is empty or not a string");
  }

  let normalized = sql.trim();
  
  // Remove trailing semicolon if present (single statement terminator is OK)
  if (normalized.endsWith(";")) {
    normalized = normalized.slice(0, -1).trim();
  }
  
  normalized = normalized.toUpperCase();

  if (!normalized.startsWith("SELECT")) {
    throw new SqlValidationError("Only SELECT queries are allowed");
  }

  // Check for multiple statements (semicolon in the middle indicates multiple statements)
  if (normalized.includes(";")) {
    throw new SqlValidationError("Multiple SQL statements are not allowed");
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (normalized.includes(` ${keyword} `) || normalized.endsWith(` ${keyword}`)) {
      throw new SqlValidationError(`Forbidden keyword in SQL: ${keyword}`);
    }
  }

  return true;
};

module.exports = {
  ensureSafeSelect
};
