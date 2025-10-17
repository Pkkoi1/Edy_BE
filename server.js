const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");

async function waitForElasticsearch() {
  let attempt = 1;
  while (true) {
    try {
      await client.ping();
      console.log("✅ Elasticsearch is ready");
      return true;
    } catch (err) {
      console.log(`⏳ Waiting for Elasticsearch... (attempt ${attempt++})`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Load environment variables
dotenv.config();

const { Client } = require("@elastic/elasticsearch");
const client = new Client({ node: process.env.ELASTICSEARCH_URL });
// Connect to MongoDB
const connectDB = require("./src/config/db");
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(cookieParser());

const cors = require("cors");
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["X-Filename", "X-Original-Title"],
  })
);

// Swagger docs
const swaggerSetup = require("./src/config/swagge");
const indexRoutes = require("./src/routes/index");
swaggerSetup(app);

const { createDocumentIndex } = require("./src/config/elasticsearch");
const { syncAllDocuments } = require("./src/services/elasticsearch.service");

// Elasticsearch
const initializeElasticsearch = async () => {
  await waitForElasticsearch();
  await createDocumentIndex();
  // Sync data lần đầu (chỉ chạy khi cần)
  // await syncAllDocuments();
};

initializeElasticsearch().catch(console.error);
// Simple root route
app.use("/api", indexRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Docs available at http://localhost:${PORT}/api-docs`);
});