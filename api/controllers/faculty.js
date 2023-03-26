const { body, validationResult } = require("express-validator");
const { findFacultyByEmail, createFaculty } = require("../user/user.service");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

module.exports = {
  login: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await findFacultyByEmail(email);

      if (!user) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({
          error: "Invalid email or password",
        });
      }

      const token = jwt.sign({ userId: user._id }, "your_secret_key_here");

      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  signUp: async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        errors: errors.array(),
      });
    }

    const { firstname, lastname, email, password, phone_number } = req.body;

    try {
      const existingUser = await findFacultyByEmail(email);

      if (existingUser) {
        return res.status(409).json({
          error: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await createFaculty({
        firstname,
        lastname,
        email,
        password: hashedPassword,
        phone_number,
      });

      res.status(201).json({
        message: "User created successfully",
      });
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  protected: (req, res) => {
    res.status(200).json({
      message: `User ${req.userId} is authenticated`,
    });
  },
};

// Validation rules for login route
exports.loginValidationRules = () => {
  return [
    body("email").isEmail().withMessage("Invalid email"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ];
};

// Validation rules for sign up route
exports.signUpValidationRules = () => {
  return [
    body("firstname").not().isEmpty().withMessage("First name is required"),
    body("lastname").not().isEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Invalid email"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    body("phone_number").isMobilePhone().withMessage("Invalid phone number"),
  ];
};
