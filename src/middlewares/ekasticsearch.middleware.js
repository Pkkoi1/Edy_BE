const { indexDocument, updateDocument, deleteDocument } = require('../services/elasticsearch.service');

// Middleware sync khi tạo document
const syncOnCreate = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 201 && data) {
      try {
        const responseData = JSON.parse(data);
        if (responseData.document) {
          // Async sync to ES
          indexDocument(responseData.document).catch(console.error);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware sync khi update document
const syncOnUpdate = (docId) => async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200 && req.body) {
      // Async sync to ES
      updateDocument(docId, req.body).catch(console.error);
    }
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = { syncOnCreate, syncOnUpdate };