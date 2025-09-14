const express = require("express");
const router = express.Router();
// Import sub-routes
const authRouter = require("./auth.routes");
const userRouter = require("./user.routes");
const documentRouter = require("./document.routes");
const organizationRouter = require("./organization.routes");

// Main routes configuration
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/documents", documentRouter);
router.use("/organizations", organizationRouter);

module.exports = router;
