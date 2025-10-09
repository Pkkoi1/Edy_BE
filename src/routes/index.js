const express = require("express");
const router = express.Router();
// Import sub-routes
const authRouter = require("./auth.routes");
const userRouter = require("./user.routes");
const documentRouter = require("./document.routes");
const organizationRouter = require("./organization.routes");
const subjectRouter = require("./subject.routes");
const accessRequestRouter = require("./access_request.routes");
const reportRouter = require("./report.routes");
const searchRouter = require("./search.routes");
const commentRouter = require("./comment.routes");

// Main routes configuration
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/documents", documentRouter);
router.use("/organizations", organizationRouter);
router.use("/subjects", subjectRouter);
router.use("/access-requests", accessRequestRouter);
router.use("/reports", reportRouter);
router.use("/search", searchRouter);
router.use("/comments", commentRouter);

module.exports = router;
