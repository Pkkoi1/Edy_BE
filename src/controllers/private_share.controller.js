
const {
    createShareLink,
    getShareLinks,
    accessShareLink,
    updateShareLinkStatus,
} = require('../services/private_share.service');

exports.createShareLink = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.userId;
        const shareOptions = req.body;

        const shareLink = await createShareLink(documentId, userId, shareOptions);

        res.status(201).json({
            message: 'Tạo link chia sẻ thành công',
            data: {
                shareLink,
                access_url: `/share/${shareLink._id}`
            }
        });
    } catch (error) {
        console.error('Error creating share link:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.getShareLinks = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.userId;

        const shareLinks = await getShareLinks(documentId, userId);

        res.json({
            message: 'Lấy danh sách share links thành công',
            data: shareLinks,
            total: shareLinks.length
        });
    } catch (error) {
        console.error('Error getting share links:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.accessShareLink = async (req, res) => {
    try {
        const { linkId } = req.params;
        const userId = req.user.userId;

        const result = await accessShareLink(linkId, userId);

        if (result.already_requested) {
            return res.status(400).json({ message: 'Bạn đã gửi yêu cầu truy cập, vui lòng chờ phê duyệt' });
        }

        if (result.request_access) {
            return res.status(202).json({ message: 'Link chia sẻ yêu cầu phê duyệt từ chủ sở hữu', required_access: true });
        }

        res.json({
            message: 'Truy cập thành công',
            data: result
        });
    } catch (error) {
        res.status(403).json({ message: error.message });
    }
};

exports.updateShareLinkStatus = async (req, res) => {
    try {
        const { linkId } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;

        const updatedLink = await updateShareLinkStatus(linkId, userId, status);

        res.json({
            message: 'Cập nhật trạng thái thành công',
            data: updatedLink
        });
    } catch (error) {
        console.error('Error updating share link status:', error);
        res.status(400).json({ message: error.message });
    }
};
