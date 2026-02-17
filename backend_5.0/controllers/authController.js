// controllers/authController.js
const authService = require("../services/authService");

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const { user, token } = await authService.signup({
      username,
      email,
      password
    });

    res.status(201).json({
      message: "Signup successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { user, token } = await authService.login({ email, password });

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  signup,
  login
};

