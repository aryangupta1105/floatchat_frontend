// controllers/alertsController.js
const { success } = require("./baseController");
const { ValidationError } = require("../utils/error");
const alertService = require("../services/alertService");

const createAlert = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || req.body.userEmail; // fallback for now

    if (!userId || !userEmail) {
      throw new ValidationError("User id/email missing for alert creation");
    }

    const payload = {
      userId,
      userEmail,
      ...req.body
    };

    const alert = await alertService.createRule(payload);
    return success(res, { alert }, 201);
  } catch (err) {
    return next(err);
  }
};

const listAlerts = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    if (!userId) {
      throw new ValidationError("User not identified for alerts");
    }

    const alerts = await alertService.listRulesByUser(userId);
    return success(res, { alerts });
  } catch (err) {
    return next(err);
  }
};

const updateAlert = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const { id } = req.params;
    const updates = req.body;

    const alert = await alertService.updateRule(userId, id, updates);
    return success(res, { alert });
  } catch (err) {
    return next(err);
  }
};

const deleteAlert = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const { id } = req.params;

    await alertService.deleteRule(userId, id);
    return success(res, { deleted: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createAlert,
  listAlerts,
  updateAlert,
  deleteAlert
};
