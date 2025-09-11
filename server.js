const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = require("./src/config/db");
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(cookieParser());

// Swagger docs
const swaggerSetup = require("./src/config/swagge");
const indexRoutes = require("./src/routes/index");
swaggerSetup(app);

// Simple root route
app.use("/api", indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Docs available at http://localhost:${PORT}/api-docs`);
});
