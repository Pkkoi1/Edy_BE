const Document = require("../models/document.model");
const EditDocument = require("../models/edit_document.model");
const User = require("../models/user.model");
const {createEditApproval} = require("../services/edit_approval.service");

const createEditDocument = async (documentId, editData, userId) => {
  try{
    const document = await Document.findById(documentId);
    if(!document) throw new Error("Tài liệu không tồn tại");
    if(document.user.toString() !== userId) throw new Error("Bạn không có quyền chỉnh sửa tài liệu này");
    if(document.status == 'REJECTED') throw new Error("Tài liệu đã bị từ chối, không thể chỉnh sửa");
    if(document.is_deleted) throw new Error("Tài liệu đã bị xóa, không thể chỉnh sửa");
    // có rồi thì override
    const existingEditDocument = await EditDocument.findOne({ original_document: documentId, is_deleted: false, status: 'PENDING' });
    if(existingEditDocument) {
      existingEditDocument.set({
        original_document: documentId,
        user: userId,
        ...editData
      });
      await existingEditDocument.save();
      return existingEditDocument;
    }

    // không có thì tạo mới
    const editDocument = new EditDocument({
      original_document: documentId,
      user: userId,
      ...editData,
    });
    await editDocument.save();
    document.status = "PENDING_EDIT";
    await document.save();

    // Tạo approval cho edit document
    await createEditApproval({
      doc: documentId,
      edit_doc: editDocument._id,
      requester: userId,
      status: 'PENDING',
    });
    return editDocument;
  } catch (error) {
    throw new Error('Có lỗi xảy ra khi chỉnh sửa tài liệu: ' + error.message);
  }
};

const updateEditDocument = async (editDocumentId, editData) => {
  try{
    const editDocument = await EditDocument.findById(editDocumentId);
    if(!editDocument) throw new Error('Bản chỉnh sửa không tồn tại');
    // nếu bản edit khác pending thì báo lỗi không thể edit
    if(editDocument.status !== 'PENDING') throw new Error('Bản chỉnh sửa đã được xử lý, không thể chỉnh sửa');
    
    // Nếu pending thì áp thẳng vào
    editDocument.set({original_document: editDocument.original_document, user: editDocument.user, ...editData});
    await editDocument.save();
    return editDocument;
  } catch (error) {
    throw new Error('Có lỗi xảy ra khi chỉnh sửa tài liệu: ' + error.message);
  }
};

const deleteEditDocument = async (editDocumentId) => {
  try{
    const editDocument = await EditDocument.findById(editDocumentId);
    // nếu bản edit khác pending thì báo lỗi không thể xóa
    if(editDocument.status !== 'PENDING') throw new Error('Bản chỉnh sửa đã được xử lý, không thể xóa');
    
    // Nếu pending thì xóa thẳng
    await editDocument.deleteOne();
    return editDocument;
  } catch (error) {
    throw new Error('Có lỗi xảy ra khi xóa tài liệu');
  }
};

const getEditDocumentByOriginalDocument = async (documentId) => {
  try{
    const editDocument = await EditDocument.findOne({ 
      original_document: documentId, 
      is_deleted: false, 
      status: 'PENDING' 
    }).populate('subject', 'name').populate('organization', 'name');
    
    if(!editDocument) throw new Error('Bản chỉnh sửa không tồn tại');
    return editDocument;
  } catch (error) {
    throw new Error('Có lỗi xảy ra khi lấy bản chỉnh sửa');
  }
};

module.exports = {
  createEditDocument,
  updateEditDocument,
  deleteEditDocument,
  getEditDocumentByOriginalDocument,
}