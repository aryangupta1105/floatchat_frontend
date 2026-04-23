// utils/error.js

class AppError extends Error {
  constructor(message, statusCode = 500, code = "APP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, code = "VALIDATION_ERROR") {
    super(message, 400, code);
  }
}

class SqlValidationError extends AppError {
  constructor(message) {
    super(message, 400, "SQL_VALIDATION_ERROR");
  }
}

module.exports = {
  AppError,
  ValidationError,
  SqlValidationError
};
