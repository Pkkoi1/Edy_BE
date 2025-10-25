const Document = require("../models/document.model");
const EditDocument = require("../models/edit_document.model");
const EditApproval = require("../models/edit_approval.model");

const createEditApproval = async (editApprovalData) => {
    const existingApproval = await EditApproval.findOne({
        doc: editApprovalData.doc,
        edit_doc: editApprovalData.edit_doc,
        user: editApprovalData.user,
        status: 'PENDING'
    });

    if (existingApproval) {
        return existingApproval;
    }

    const editApproval = new EditApproval(editApprovalData);
    return await editApproval.save();
}

const getEditApprovalById = async (id) => {
    return await EditApproval.findById(id).populate('doc edit_doc user reviewed_by');
}

const getEditApprovalsByEditDocId = async (editDocId) => {
    return await EditApproval.find({ edit_doc: editDocId }).populate('doc edit_doc user reviewed_by');
}

const getEditApprovalByOriginalDocumentId = async (docId) => {
    return await EditApproval.find({ doc: docId, status: 'PENDING' });
}

const deleteEditApprovalByEditId = async (editId) => {
    return await EditApproval.deleteMany({ edit_doc: editId });
}

const handleEditApproval = async (editApprovalId, actionData) => {
    const {action, message} = actionData;
    if (action !== 'APPROVE' && action !== 'REJECT') throw new Error('Hành động không hợp lệ');
    const editApproval = await getEditApprovalById(editApprovalId);
    const editDoc = await EditDocument.findById(editApproval.edit_doc);
    if (!editApproval) throw new Error('Phê duyệt chỉnh sửa không tồn tại');
    if (editApproval.status !== 'PENDING') throw new Error('Phê duyệt chỉnh sửa không còn đang chờ duyệt');

    if (action === 'APPROVE') {
        await approveEditApproval(editApprovalId, message);
        editDoc.status = 'APPROVED';
        await editDoc.save()
        await applyDataToDocument(editDoc._id);
        return editApproval;

    } else if (action === 'REJECT') {
        editDoc.status = 'REJECTED';
        await editDoc.save()
        await rejectEditApproval(editApprovalId, message);
        return editApproval;
    }
}

const approveEditApproval = async (editApprovalId, message) => {
    const currentTime = Date.now();
    const editApproval = await getEditApprovalById(editApprovalId);
    if (!editApproval) throw new Error('Edit approval not found');
    if (editApproval.status !== 'PENDING') throw new Error('Edit approval is not pending');
    editApproval.status = 'APPROVED';
    editApproval.reviewed_at = currentTime;
    editApproval.reviewed_by = editApproval.user;
    editApproval.message = message;
    editApproval.expiredAt = new Date(currentTime + 24 * 60 * 60 * 1000);
    await editApproval.save();
}

const rejectEditApproval = async (editApprovalId, message) => {
    const currentTime = Date.now();
    const editApproval = await getEditApprovalById(editApprovalId);
    if (!editApproval) throw new Error('Edit approval not found');
    if (editApproval.status !== 'PENDING') throw new Error('Edit approval is not pending');
    editApproval.status = 'REJECTED';
    editApproval.reviewed_at = currentTime;
    editApproval.reviewed_by = editApproval.user;
    editApproval.message = message;
    editApproval.expiredAt = new Date(currentTime + 24 * 60 * 60 * 1000);
    await editApproval.save();
}

const updateEditDocumentStatus = async (editDocId, status) => {
    const editDoc = await EditDocument.findById(editDocId);
    if (!editDoc) throw new Error('Edit document not found');
    editDoc.status = status;
    return await editDoc.save();
}

const applyDataToDocument = async (editDocId) => {
    const editDoc = await EditDocument.findById(editDocId);
    if (!editDoc) throw new Error('Edit document not found');

    // xóa những field document không cần thiết
    delete editDoc.original_document;
    delete editDoc.expiredAt;
    delete editDoc.is_deleted;
    delete editDoc.edit_type;


    if (editDoc.status !== 'APPROVED') throw new Error('Edit document is not approved');
    const document = await Document.findById(editDoc.original_document);
    if (!document) throw new Error('Document not found');

    const descObj = {...document.description};
    descObj.summary_by_user = editDoc.summary_by_user;
    document.description = descObj;
    document.status = 'APPROVED';
    
    if(editDoc.title) document.title = editDoc.title;
    if(editDoc.url) document.url = editDoc.url;
    if(editDoc.author) document.author = editDoc.author;
    if(editDoc.publisher) document.publisher = editDoc.publisher;
    if(editDoc.published_year) document.published_year = editDoc.published_year;
    if(editDoc.cover_page) document.cover_page = editDoc.cover_page;
    if(editDoc.organization) document.organization = editDoc.organization;
    if(editDoc.level) document.level = editDoc.level;
    if(editDoc.subject) document.subject = editDoc.subject;
    if(editDoc.public_mode) document.public_mode = editDoc.public_mode;
    if(editDoc.page) document.page = editDoc.page;
    if(editDoc.file_type) document.file_type = editDoc.file_type;
    if(editDoc.doc_type) document.doc_type = editDoc.doc_type;

    return await document.save();
}

module.exports = {
    createEditApproval,
    getEditApprovalById,
    getEditApprovalsByEditDocId,
    getEditApprovalByOriginalDocumentId,
    handleEditApproval,
    deleteEditApprovalByEditId,
}