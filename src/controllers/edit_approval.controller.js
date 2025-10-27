const {
    createEditApproval,
    getEditApprovalById,
    getEditApprovalsByEditDocId,
    getEditApprovalByOriginalDocumentId,
    handleEditApproval,
} = require("../services/edit_approval.service");

exports.getEditApprovalById = async (req, res) => {
    try {
        const editApproval = await getEditApprovalById(req.params.id);
        res.status(200).json(editApproval);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

exports.getEditApprovalsByEditDocId = async (req, res) => {
    try {
        const editApprovals = await getEditApprovalsByEditDocId(req.params.editDocId);
        res.status(200).json(editApprovals);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

exports.getEditApprovalByOriginalDocId = async (req, res) => {
    try {
        const editApprovals = await getEditApprovalByOriginalDocumentId(req.params.documentId);
        // Return the first pending approval, or null if none exists
        const editApproval = Array.isArray(editApprovals) && editApprovals.length > 0 ? editApprovals[0] : null;
        
        if (!editApproval) {
            return res.status(404).json({ message: 'Không tìm thấy yêu cầu chỉnh sửa' });
        }
        
        res.status(200).json(editApproval);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

exports.handleEditApproval = async (req, res) => {
    try {
        const actionData = req.body;
        const editApproval = await handleEditApproval(req.params.editApprovalId, actionData);
        res.status(200).json({
            message: 'Xử lý phê duyệt chỉnh sửa thành công',
            editApproval
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}
