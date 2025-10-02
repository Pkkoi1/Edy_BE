const express = require("express");
const router = express.Router();
// Import sub-routes
const authRouter = require("./auth.routes");
const userRouter = require("./user.routes");
const documentRouter = require("./document.routes");
const organizationRouter = require("./organization.routes");
const subjectRouter = require("./subject.routes");
const accessRequestRouter = require("./access_request.routes");

// Main routes configuration
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/documents", documentRouter);
router.use("/organizations", organizationRouter);
router.use("/subjects", subjectRouter);
router.use("/access-requests", accessRequestRouter);

module.exports = router;
