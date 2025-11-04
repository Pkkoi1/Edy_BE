const mongoose = require('mongoose');
const Document = require("../models/document.model");
const EditDocument = require("../models/edit_document.model");
const EditApproval = require("../models/edit_approval.model");
const { getEligibleApprovers } = require("./approval_request.service");

const createEditApproval = async (editApprovalData) => {
    const existingApproval = await EditApproval.findOne({
        doc: editApprovalData.doc,
        edit_doc: editApprovalData.edit_doc,
        requester: editApprovalData.requester,
        status: 'PENDING'
    });

    if (existingApproval) {
        return existingApproval;
    }

    const editApproval = new EditApproval(editApprovalData);
    await editApproval.save();

    // Tự động gán edit approval request cho admin có ít pending request nhất
    try {
        // Lấy organization từ edit_doc hoặc doc gốc
        const editDoc = await EditDocument.findById(editApprovalData.edit_doc);
        const documentOrgId = editDoc?.organization || null;
        
        // Nếu edit_doc không có organization, lấy từ document gốc
        if (!documentOrgId) {
            const document = await Document.findById(editApprovalData.doc);
            if (document) {
                await assignEditApproval(editApproval._id, document.organization || null);
            }
        } else {
            await assignEditApproval(editApproval._id, documentOrgId);
        }
    } catch (error) {
        console.error(`Lỗi khi tự động gán edit approval request ${editApproval._id}:`, error);
        // Không throw error để không ảnh hưởng đến việc tạo edit approval request
    }

    return editApproval;
}

const getEditApprovalById = async (id) => {
    return await EditApproval.findById(id).populate('doc edit_doc requester reviewed_by');
}

const getEditApprovalsByEditDocId = async (editDocId) => {
    return await EditApproval.find({ edit_doc: editDocId }).populate('doc edit_doc requester reviewed_by');
}

const getEditApprovalByOriginalDocumentId = async (docId) => {
    return await EditApproval.find({ doc: docId, status: 'PENDING' })
        .populate('doc')
        .populate('edit_doc')
        .populate('requester', 'first_name last_name')
        .populate('reviewed_by', 'first_name last_name')
        .sort({ createdAt: -1 });
}

const deleteEditApprovalByEditId = async (editId) => {
    return await EditApproval.deleteMany({ edit_doc: editId });
}

const handleEditApproval = async (editApprovalId, actionData, approver) => {
    const {action, message} = actionData;
    if (action !== 'APPROVE' && action !== 'REJECT') throw new Error('Hành động không hợp lệ');
    const editApproval = await getEditApprovalById(editApprovalId);
    const editDoc = await EditDocument.findById(editApproval.edit_doc);
    if (!editApproval) throw new Error('Phê duyệt chỉnh sửa không tồn tại');
    if (editApproval.status !== 'PENDING') throw new Error('Phê duyệt chỉnh sửa không còn đang chờ duyệt');

    if (action === 'APPROVE') {
        await approveEditApproval(editApprovalId, message, approver);
        editDoc.status = 'APPROVED';
        editDoc.expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await editDoc.save()
        await applyDataToDocument(editDoc._id);
        return editApproval;

    } else if (action === 'REJECT') {
        editDoc.status = 'REJECTED';
        editDoc.expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await editDoc.save()
        await rejectEditApproval(editApprovalId, message, approver);
        return editApproval;
    }
}

const approveEditApproval = async (editApprovalId, message, approver) => {
    const currentTime = Date.now();
    const editApproval = await getEditApprovalById(editApprovalId);
    if (!editApproval) throw new Error('Edit approval not found');
    if (editApproval.status !== 'PENDING') throw new Error('Edit approval is not pending');
    editApproval.status = 'APPROVED';
    editApproval.reviewed_at = currentTime;
    editApproval.reviewed_by = approver;
    editApproval.message = message;
    editApproval.expiredAt = new Date(currentTime + 24 * 60 * 60 * 1000);
    await editApproval.save();
}

const rejectEditApproval = async (editApprovalId, message, approver) => {
    const currentTime = Date.now();
    const editApproval = await getEditApprovalById(editApprovalId);
    if (!editApproval) throw new Error('Edit approval not found');
    if (editApproval.status !== 'PENDING') throw new Error('Edit approval is not pending');
    editApproval.status = 'REJECTED';
    editApproval.reviewed_at = currentTime;
    editApproval.reviewed_by = approver;
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
    const editDoc = await EditDocument.findById(editDocId).populate('original_document');
    if (!editDoc) throw new Error('Edit document not found');

    if (editDoc.status !== 'APPROVED') throw new Error('Edit document is not approved');
    
    // Get original document ID before it's lost
    const originalDocumentId = editDoc.original_document;
    const document = await Document.findById(originalDocumentId);
    if (!document) throw new Error('Document not found');

    // Update description
    if (editDoc.summary_by_user) {
        const descObj = {...document.description};
        descObj.summary_by_user = editDoc.summary_by_user;
        document.description = descObj;
    }
    
    // Update document status and data from edit
    document.status = 'APPROVED';
    if(editDoc.title) document.title = editDoc.title;
    if(editDoc.url) document.url = editDoc.url;
    if(editDoc.author && editDoc.author.length > 0) document.author = editDoc.author;
    if(editDoc.publisher) document.publisher = editDoc.publisher;
    if(editDoc.published_year) document.published_year = editDoc.published_year;
    if(editDoc.cover_page) document.cover_page = editDoc.cover_page;
    if(editDoc.organization) document.organization = editDoc.organization;
    if(editDoc.level) document.level = editDoc.level;
    if(editDoc.subject) document.subject = editDoc.subject;
    if(editDoc.public_mode) document.public_mode = editDoc.public_mode;
    if(editDoc.page !== undefined) document.page = editDoc.page;
    if(editDoc.file_type) document.file_type = editDoc.file_type;
    if(editDoc.keyword && editDoc.keyword.length > 0) document.keyword = editDoc.keyword;
    if(editDoc.doc_type) document.doc_type = editDoc.doc_type;

    return await document.save();
}

// gán edit approval request cho admin có ít pending nhất
const assignEditApproval = async (editApprovalId, documentOrganizationId) => {
    try {
        // Lấy danh sách admin có thể duyệt
        const eligibleUserIds = await getEligibleApprovers(documentOrganizationId);

        // ko có admin -> gán null. assigned_to sẽ là null
        if (eligibleUserIds.length === 0) {
            return null;
        }
        
        // Đếm số lượng edit approval request đang pending cho mỗi admin (chỉ đếm riêng EditApproval)
        const pendingCounts = await EditApproval.aggregate([
            {
                $match: {
                    assigned_to: { $in: eligibleUserIds },
                    status: 'PENDING'
                }
            },
            {
                $group: {
                    _id: '$assigned_to',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: 1 }
            },
            {
                $limit: 1
            }
        ]);

        // Tìm admin được chọn
        let selectedUserId = null;
        let minPendingCount = 0;

        if (pendingCounts.length > 0) {
            // Có admin đã có pending edit approval requests, chọn admin có ít nhất
            selectedUserId = pendingCounts[0]._id;
            minPendingCount = pendingCounts[0].count;
        } else {
            // Tất cả admin đều có 0 pending edit approval request
            // Chọn admin đầu tiên trong danh sách eligible
            selectedUserId = eligibleUserIds[0];
            minPendingCount = 0;
        }

        // Cập nhật edit approval request với assigned_to
        if (selectedUserId) {
            await EditApproval.findByIdAndUpdate(editApprovalId, {
                assigned_to: selectedUserId
            }, { new: true });
            console.log(`Đã gán edit approval request ${editApprovalId} cho admin ${selectedUserId} (có ${minPendingCount} pending request)`);
            return selectedUserId;
        }

        return null;
    } catch (error) {
        console.error('Lỗi khi gán edit approval request:', error);
        throw new Error(`Lỗi khi gán edit approval request: ${error.message}`);
    }
};

module.exports = {
    createEditApproval,
    getEditApprovalById,
    getEditApprovalsByEditDocId,
    getEditApprovalByOriginalDocumentId,
    handleEditApproval,
    deleteEditApprovalByEditId,
    assignEditApproval,
}