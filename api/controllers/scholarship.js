const { validationResult } = require("express-validator");

const Scholarship = require("../models/scholarship");
const User = require("../models/user");
const { getContentType } = require("../../util/contentType");

const jwt = require("jsonwebtoken");
const url = require("url");
const path = require("path");
const fs = require("fs");
const { createReadStream } = require("fs");
const mongoose = require("mongoose");

module.exports = {
  getScholarshipList: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const scholarshipList = await Scholarship.find().sort({ _id: -1 });

      // Modifying the date format
      const scholarshipData = scholarshipList.map((scholarship) => {
        const issueDate = new Date(scholarship.issueDate);
        const closeDate = new Date(scholarship.closeDate);

        return {
          ...scholarship.toObject(),
          issueDate: {
            month: issueDate.toLocaleString("default", { month: "long" }),
            day: issueDate.getDate(),
            year: issueDate.getFullYear(),
          },
          closeDate: {
            month: closeDate.toLocaleString("default", { month: "long" }),
            day: closeDate.getDate(),
            year: closeDate.getFullYear(),
          },
        };
      });

      res.json(scholarshipData);
    } catch (error) {
      res.status(500).json({
        message: "Something went wrong with the api",
        error: error.message,
      });
    }
  },

  getScholarshipListById: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const id = req.params.id; //To seprate the id from the parameter

      const foundScholarship = await Scholarship.findById(id);
      if (!foundScholarship) {
        return res.status(404).json({
          message: "Scholarship not found",
        });
      }

      // Modifying the date format
      const issueDate = new Date(foundScholarship.issueDate);
      const closeDate = new Date(foundScholarship.closeDate);
      const scholarshipData = {
        ...foundScholarship.toObject(),
        _id: foundScholarship._id.toString(),
        issueDate: {
          month: issueDate.toLocaleString("default", { month: "long" }),
          day: issueDate.getDate(),
          year: issueDate.getFullYear(),
        },
        closeDate: {
          month: closeDate.toLocaleString("default", { month: "long" }),
          day: closeDate.getDate(),
          year: closeDate.getFullYear(),
          dateObj: foundScholarship.closeDate,
        },
      };
      res.json(scholarshipData);
    } catch (error) {
      res.status(500).json({
        message: "Something went wrong with the api",
        error: error.message,
      });
    }
  },

  getFeaturedScholarshipList: async (req, res) => {
    try {
      // Parse the URL using the Node.js built-in url module.
      const urlObj = url.parse(req.url, true);

      // Extracting the qty query parameter from the urlObj object.
      const qty = urlObj.query.qty;

      // Converting the qty parameter to a number.
      const qtyNum = parseInt(qty);

      // Fetching the top ten scholarship lists from your MongoDB database.
      const topScholarships = await Scholarship.find()
        .sort({ popularity: -1 })
        .limit(qtyNum);

      // Modifying the date format
      const scholarshipData = topScholarships.map((scholarship) => {
        const issueDate = new Date(scholarship.issueDate);
        const closeDate = new Date(scholarship.closeDate);

        return {
          ...scholarship.toObject(),
          issueDate: {
            month: issueDate.toLocaleString("default", { month: "long" }),
            day: issueDate.getDate(),
            year: issueDate.getFullYear(),
          },
          closeDate: {
            month: closeDate.toLocaleString("default", { month: "long" }),
            day: closeDate.getDate(),
            year: closeDate.getFullYear(),
          },
        };
      });

      res.json(scholarshipData);
    } catch (error) {
      res.status(500).json({
        message: "Something went wrong with the api",
        error: error.message,
      });
    }
  },

  getAppliedScholarshipList: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const userId = req.userId; // extract userId from token

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let appliedScholarships = user.appliedScholarship.map((scholarship) => {
        return {
          status: scholarship.status,
          scholarshipId: scholarship.scholarshipId.toString(),
        };
      });

      res.json({ appliedScholarships });
    } catch (error) {
      res.status(500).json({
        message: "Something went wrong with the api",
        error: error.message,
      });
    }
  },
  appliedScholarship: async (req, res) => {
    try {
      const userId = req.userId; // extract userId from token
      const scholarshipId = req.params.id;
      const { otherRequirements } = req.body;

      const { body } = req;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if all profile information fields are completely filled
      const { personalInfo, familyDetails, education } = user;
      if (user.profileStatus != 100) {
        return res.status(400).json({
          error:
            "Please fill in all the required profile information before applying for a scholarship.",
        });
      }

      // Check weather user already applied in that scholarship
      const hasApplied = user.appliedScholarship.some(
        (scholarship) => scholarship.scholarshipId.toString() === scholarshipId
      );
      if (hasApplied) {
        return res.json({
          error: "User has already applied to this scholarship",
        });
      }

      // Check if any user's scholarship has already approved
      const hasApproved = user.appliedScholarship.some(
        (scholarship) => scholarship.status === "approved"
      );
      if (hasApproved) {
        return res.json({
          error: "User already has an approved scholarship",
        });
      } else {
        //Now checking weather the user profile meeting scolarship criteria
        const scholarshipDetails = await Scholarship.findById(scholarshipId);
        if (!scholarshipDetails) {
          return res.status(404).json({
            message: "Scholarship not found",
          });
        }

        // For merit-based scholarships
        if (scholarshipDetails.type === "merit") {
          // Criteria
          if (
            scholarshipDetails.matricPercentage >
            user.education.matric.percentage
          ) {
            return res.status(400).json({
              error:
                "You are not eligible for this scholarship because your matric % is not enough.",
            });
          }
          if (
            scholarshipDetails.intermediatePercentage >
            user.education.intermediate.percentage
          ) {
            return res.status(400).json({
              error:
                "You are not eligible for this scholarship because your inter % is not enough.",
            });
          }
          if (
            scholarshipDetails.bachelorCGPA >
            user.education.bachelor.obtainedCGPA
          ) {
            return res.status(400).json({
              error:
                "You are not eligible for this scholarship because your CGPA is not enough.",
            });
          }
        }

        // For need-based scholarships
        if (scholarshipDetails.type === "need") {
          // Criteria
          if (
            scholarshipDetails.familyIncome < user.familyDetails.grossIncome
          ) {
            return res.status(400).json({
              error:
                "You are not eligible for this scholarship because your family income does not match the criteria.",
            });
          }
        }

        user.appliedScholarship.push({
          scholarshipId: new mongoose.Types.ObjectId(scholarshipId),
          status: "awaiting",
          otherRequirements: otherRequirements,
        });
        await user.save();

        // Getting the updated applied scholarship object
        const updatedAppliedScholarships = user.appliedScholarship.map(
          (scholarship) => {
            return {
              status: scholarship.status,
              scholarshipId: scholarship.scholarshipId.toString(),
            };
          }
        );
        return res.json({
          success: "Applied scholarship added to user",
          appliedScholarships: updatedAppliedScholarships,
        });
      }
    } catch (error) {
      console.error("Error in appliedScholarship", error);
      return res.status(500).json({
        message: "Something went wrong with the API",
        error: error.message,
      });
    }
  },
  getScholarshipImg: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
      }

      const scholarshipId = req.params.id;

      const foundScholarship = await Scholarship.findById(scholarshipId);
      if (!foundScholarship) {
        return res.status(404).json({
          message: "Scholarship not found",
        });
      }

      let scholarshipImg = foundScholarship.image;
      if (!scholarshipImg) {
        return res.status(400).json({
          message: "Scholarship image not found",
        });
      }
      const filePath = path.resolve("images/scholarshipImg/" + scholarshipImg);
      if (!fs.existsSync(filePath)) {
        return res.status(401).json({
          message: "Invalid File",
        });
      }
      const contentType = getContentType(filePath);
      res.set("Content-Type", contentType);
      const fileStream = createReadStream(filePath);

      fileStream.on("error", (error) => {
        console.error(error);
        res.status(500).end();
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error("Error in appliedScholarship", error);
      return res.status(500).json({
        message: "Something went wrong with the API",
        error: error.message,
      });
    }
  },
};
