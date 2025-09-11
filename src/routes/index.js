const express = require("express");
const router = express.Router();
// Import sub-routes
const authRouter = require("./auth.routes");
const userRouter = require("./user.routes");

// Main routes configuration
router.use("/auth", authRouter);
router.use("/users", userRouter);

module.exports = router;
