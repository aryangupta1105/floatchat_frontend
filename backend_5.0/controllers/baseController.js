// controllers/baseController.js

const success = (res, data = {}, status = 200) => {
  return res.status(status).json({
    ok: true,
    ...data
  });
};

const error = (res, message, code = "ERROR", status = 400) => {
  return res.status(status).json({
    ok: false,
    error: { message, code }
  });
};

module.exports = {
  success,
  error
};
