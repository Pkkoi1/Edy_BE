const PrivateShare = require('../models/private_share.model');
const Document = require('../models/document.model');
const User = require('../models/user.model');
const AccessRequest = require('../models/access_request.model');
const createShareLink = async (documentId, userId, shareOptions = {}) => {
    try {
        // Kiểm tra document tồn tại và user có quyền
        const document = await Document.findById(documentId).populate('user');
        if (!document) {
            throw new Error('Tài liệu không tồn tại');
        }

        if (document.user._id.toString() !== userId) {
            throw new Error('Chỉ chủ sở hữu mới có thể tạo link chia sẻ');
        }

        if (document.status !== 'APPROVED') {
            throw new Error('Chỉ tài liệu đã được phê duyệt mới có thể tạo link chia sẻ');
        }

        if (document.public_mode === 'PUBLIC' || document.public_mode === 'SHARE_ORGANIZATION') {
            throw new Error('Tài liệu đang ở chế độ công khai, không thể tạo link chia sẻ riêng tư');
        }
        const shareLink = new PrivateShare({
            name: shareOptions.name || `Link chia sẻ ${document.title}`,
            doc: documentId,
            limited_access: shareOptions.limited_access || null,
            request: shareOptions.request || false,
            time_limited: shareOptions.time_limited || false,
            start_date: shareOptions.start_date || null,
            end_date: shareOptions.end_date || null,
            status: 'ACTIVE'
        });

        await shareLink.save();

        // Update document public_mode nếu cần
        if (document.public_mode !== 'PRIVATE_SHARED') {
            document.public_mode = 'PRIVATE_SHARED';
            await document.save();
        }

        const link = await PrivateShare.findById(shareLink._id);
        return link;
    } catch (error) {
        throw new Error(`Lỗi tạo link chia sẻ: ${error.message}`);
    }
};

// Lấy danh sách share links của document
const getShareLinks = async (documentId, userId) => {
    try {
        // Kiểm tra quyền truy cập
        const document = await Document.findById(documentId);
        if (!document) {
            throw new Error('Tài liệu không tồn tại');
        }

        if (document.user.toString() !== userId) {
            throw new Error('Chỉ chủ sở hữu mới có thể xem danh sách link chia sẻ');
        }

        const shareLinks = await PrivateShare.find({ doc: documentId })
            .populate('user_accessed', 'first_name last_name avatar contact_email')
            .sort({ createdAt: -1 });

        return shareLinks.map(link => ({
            _id: link._id,
            access_url: `/share/${link._id}`,
            name: link.name,
            limited_access: link.limited_access,
            request: link.request,
            time_limited: link.time_limited,
            start_date: link.start_date,
            end_date: link.end_date,
            status: link.status,
            user_accessed: link.user_accessed,
            access_count: link.user_accessed.length,
            createdAt: link.createdAt,
        }));
    } catch (error) {
        throw new Error(`Lỗi lấy danh sách share links: ${error.message}`);
    }
};

// Kiểm tra link validity và cấp quyền truy cập
const accessShareLink = async (linkId, userId) => {
    try {
        const current = new Date();
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('Người dùng không tồn tại');
        }

        const shareLink = await PrivateShare.findById(linkId)
            .populate('doc');

        if (!shareLink) {
            throw new Error('Link chia sẻ không tồn tại');
        }

        // const isActive = shareLink.status === 'ACTIVE';
        // const isExpired = shareLink.time_limited && shareLink.end_date && (current > shareLink.end_date || current < shareLink.start_date);
        // tạm để đây nhé, tương lai có lẽ cần ;))

        const isOwner = shareLink.doc.user.toString() === userId;
        if (isOwner) {
            return {
                documentId: shareLink.doc._id,
                documentTitle: shareLink.doc.title,
                access_granted: false,
                redirect_url: `/document-detail/${shareLink.doc._id}`
            };
        }

        //Kiểm tra documentId vốn đã nằm trong shared_document của user chưa
        const alreadyHasAccess = user.shared_documents.some(
            item => item.document.toString() === shareLink.doc._id.toString()
        );

        if (alreadyHasAccess) {
            return {
                documentId: shareLink.doc._id,
                documentTitle: shareLink.doc.title,
                access_granted: false,
                redirect_url: `/document-detail/${shareLink.doc._id}`
            };
        }

        // Kiểm tra status
        if (shareLink.status !== 'ACTIVE') {
            throw new Error('Link chia sẻ đã bị vô hiệu hóa');
        }
        // Kiểm tra time limit
        if (shareLink.time_limited) {
            if (shareLink.start_date && current < shareLink.start_date) {
                throw new Error('Link chia sẻ không có hiệu lực');
            }
            if (shareLink.end_date && current > shareLink.end_date) {
                throw new Error('Link chia sẻ không có hiệu lực');
            }
        }

        // Kiểm tra access limit
        if (shareLink.limited_access && shareLink.user_accessed.length >= shareLink.limited_access) {
            throw new Error('Link chia sẻ đã đạt giới hạn người truy cập');
        }

        if(shareLink.request) {
            // Nếu cùng 1 doc đã có request access rồi thì trả vè đã tồn tại request
            const existingRequest = await AccessRequest.findOne({
                doc: shareLink.doc._id,
                user: userId,
                status: 'PENDING'
            });
            if (existingRequest) 
                return {already_requested: true};

            return {request_access: true};
        }

        // Add user to access list nếu chưa có
        shareLink.user_accessed.push(userId);
        user.shared_documents.push({
            document: shareLink.doc._id,
            shared_at: current
        });

        await Promise.all([
            shareLink.save(),
            user.save()
        ]);

        return {
            documentId: shareLink.doc._id,
            documentTitle: shareLink.doc.title,
            access_granted: true,
            redirect_url: `/document-detail/${shareLink.doc._id}`
        };
    } catch (error) {
        throw new Error(error.message);
    }
};

// Update share link status
const updateShareLinkStatus = async (linkId, userId, newStatus) => {
    try {
        const shareLink = await PrivateShare.findById(linkId).populate('doc');
        if (!shareLink) {
            throw new Error('Share link không tồn tại');
        }

        // Kiểm tra quyền
        if (shareLink.doc.user.toString() !== userId) {
            throw new Error('Chỉ chủ sở hữu mới có thể thay đổi trạng thái link');
        }

        if (!['ACTIVE', 'INACTIVE', 'DISABLED'].includes(newStatus)) {
            throw new Error('Trạng thái không hợp lệ');
        }

        if (shareLink.status === 'DISABLED') {
            throw new Error('Link đã bị vô hiệu hóa, không thể thay đổi trạng thái');
        }

        shareLink.status = newStatus;
        await shareLink.save();

        if (newStatus == 'DISABLED') {
            //loại bỏ shared_document của các user trong user_accessed
            for (const accessedUserId of shareLink.user_accessed) {
                const user = await User.findById(accessedUserId);
                if (user) {
                    user.shared_documents = user.shared_documents.filter(
                        item => item.document.toString() !== shareLink.doc._id.toString()
                    );
                    await user.save();
                }
            }
            // Nếu document không có share link active hoặc inactive nào thì chuyển public_mode về PRIVATE
            const otherActiveLinks = await PrivateShare.find({
                doc: shareLink.doc._id,
                status: { $in: ['ACTIVE', 'INACTIVE'] }
            });
            if (otherActiveLinks.length === 0) {
                const document = await Document.findById(shareLink.doc._id);
                if (document.public_mode === 'PRIVATE_SHARED') {
                    document.public_mode = 'PRIVATE';
                    await document.save();
                }
            }
        }
        return shareLink;
    } catch (error) {
        throw new Error(`Lỗi cập nhật trạng thái: ${error.message}`);
    }
};

module.exports = {
    createShareLink,
    getShareLinks,
    accessShareLink,
    updateShareLinkStatus,
};