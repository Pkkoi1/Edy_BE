const { parentPort, workerData } = require("worker_threads");
const { processDocumentAndCreateEmbedding } = require("../utils/tranformers");

(async () => {
  try {
    const { url, fileType } = workerData;
    const result = await processDocumentAndCreateEmbedding(url, fileType);
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  }
})();