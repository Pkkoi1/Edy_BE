const {
  createEditDocument,
  updateEditDocument,
  deleteEditDocument,
  getEditDocumentByOriginalDocument,
} = require("../services/edit_document.service");
const {
  createEditApproval,
  deleteEditApprovalByEditId,
} = require("../services/edit_approval.service");
const {
  logDocumentEditRequested,
} = require("../services/activity_log.service");

exports.createEditDocument = async (req, res) => {
  try {
    const editData = req.body;
    const documentId = req.params.documentId;
    const editDocument = await createEditDocument(
      documentId,
      editData,
      req.user.userId
    );

    // Log activity for edit request
    await logDocumentEditRequested(documentId, req.user.userId);

    res.status(201).json(editDocument);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateEditDocument = async (req, res) => {
  try {
    const editData = req.body;
    const editDocument = await updateEditDocument(req.params.editId, editData);
    res.status(200).json(editDocument);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteEditDocument = async (req, res) => {
  try {
    await deleteEditDocument(req.params.editId);
    await deleteEditApprovalByEditId(req.params.editId);
    res.status(200).json({ message: "Bản chỉnh sửa đã được xóa" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getEditDocumentByOriginalDocument = async (req, res) => {
  try {
    const editDocument = await getEditDocumentByOriginalDocument(
      req.params.documentId
    );
    res.status(200).json(editDocument);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
