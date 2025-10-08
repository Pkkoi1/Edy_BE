const Report = require('../models/report.model');
const Document = require('../models/document.model');
const Comment = require('../models/comment.model');
const User = require('../models/user.model');
const ViolationLog = require('../models/violation_log.model');
const Restriction = require('../models/restriction.model');
const Account =require('../models/account.model')
const {createPointTransaction} = require("./point_transaction.service");
const createReport = async (reportData, reporterId) => {
    try {
        const { docId, cmtId, type, reason } = reportData;
        // Validate document tồn tại
        const document = await Document.findById(docId);
        if (!document) {
            throw new Error('Tài liệu không tồn tại');
        }

        // Validate comment nếu có
        if (cmtId) {
            const comment = await Comment.findById(cmtId);
            if (!comment) {
                throw new Error('Bình luận không tồn tại');
            }
            if (comment.doc.toString() !== docId) {
                throw new Error('Bình luận không thuộc tài liệu này');
            }
        }

        // Kiểm tra user đã report cùng target chưa
        const existingReport = await Report.findOne({
            doc: docId,
            cmt: cmtId || null,
            reporter: reporterId,
            status: 'PROCESSING'
        });

        if (existingReport) {
            throw new Error('Bạn đã báo cáo mục này rồi');
        }

        // Tạo report mới
        const report = new Report({
            doc: docId,
            cmt: cmtId || null,
            reporter: reporterId,
            type,
            reason,
            status: 'PROCESSING'
        });

        await report.save();

        const populatedReport = await Report.findById(report._id)
            .populate('doc', 'title author')
            .populate('cmt', 'content')
            .populate('reporter', 'first_name last_name');

        return populatedReport;
    } catch (error) {
        throw new Error(`Lỗi tạo báo cáo: ${error.message}`);
    }
};

const getAllReports = async (filters = {}) => {
    try {
        const {
            status,
            type,
            search,
            page = 1,
            limit = 10,
            ordering = 'createdAt',
            order = 1
        } = filters;

        const skip = (page - 1) * limit;

        let query = {};

        if (status) {
            query.status = status;
        }

        if (type) {
            query.type = { $in: Array.isArray(type) ? type : [type] };
        }

        // Search trong title của document hoặc reason
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };

            // Tìm documents có title match search
            const matchingDocs = await Document.find(
                { title: searchRegex },
                { _id: 1 }
            );
            const docIds = matchingDocs.map(doc => doc._id);

            query.$or = [
                { reason: searchRegex },
                { doc: { $in: docIds } }
            ];
        }

        // Sort
        const sort = {};
        sort[ordering] = parseInt(order);

        const [reports, total] = await Promise.all([
            Report.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('doc', 'title author status')
                .populate('cmt', 'content')
                .populate('reporter', 'first_name last_name avatar')
                .populate('resolveBy', 'first_name last_name'),
            Report.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);
        const have_next = page < totalPages;

        return {
            reports,
            total,
            page,
            totalPages,
            have_next
        };
    } catch (error) {
        throw new Error(`Lỗi lấy danh sách báo cáo: ${error.message}`);
    }
};

const resolveReport = async (reportId, adminId, resolution) => {
    try {
        const { validTypes, action, resolveReason } = resolution;

        // Validate action
        const validActions = ['EDIT_REQUESTED', 'DELETE', 'FALSE_REPORT'];
        if (!validActions.includes(action)) {
            throw new Error('Hành động xử lý không hợp lệ');
        }

        // Tìm report
        const report = await Report.findById(reportId);
        if (!report) {
            throw new Error('Báo cáo không tồn tại');
        }

        if (report.status === 'RESOLVED') {
            throw new Error('Báo cáo đã được xử lý');
        }

        // Update report
        report.status = 'RESOLVED';
        report.action = action;
        report.resolveReason = resolveReason || null;
        report.validTypes = validTypes || [];
        report.resolveBy = adminId;
        report.resolvedAt = new Date();

        await report.save();

        // Xử lý action tương ứng
        await handleReportAction(report, action);

        // Return report đã resolve
        const resolvedReport = await Report.findById(reportId)
            .populate('doc', 'title author status')
            .populate('cmt', 'content')
            .populate('reporter', 'first_name last_name')
            .populate('resolveBy', 'first_name last_name');

        return resolvedReport;
    } catch (error) {
        throw new Error(`Lỗi xử lý báo cáo: ${error.message}`);
    }
};

module.exports = {
    createReport,
    getAllReports,
    resolveReport
};

const handleReportAction = async (report, action) => {
    try {
        // Lấy ra người vi phạm (chủ sở hữu document hoặc người comment)
        let violatorId;
        if (report.cmt) {
            const comment = await Comment.findById(report.cmt);
            violatorId = comment?.user;
        } else {
            const document = await Document.findById(report.doc);
            violatorId = document?.user;
        }

        if (!violatorId) {
            throw new Error('Không xác định được người vi phạm');
        }

        const violator = await User.findById(violatorId);
        if (!violator) {
            throw new Error('Người dùng vi phạm không tồn tại');
        }

        const point_reduced = calculatePointReduction(report.validTypes, violator.strike || 0);
        switch (action) {
            case 'DELETE':
                if (report.cmt) {
                    // Xóa comment
                    await Comment.findByIdAndUpdate(report.cmt, {
                        is_deleted: true,
                        deleted_at: new Date()
                    });

                    // ghi log
                    const document = await Document.findById(report.doc).populate('user');
                    if (document && document.user) {
                        await ViolationLog.create({
                            user: violatorId,
                            doc: report.doc,
                            cmt: report.cmt,
                            type: report.validTypes,
                            report: report._id,
                            strike: 1,
                            point_reduced: point_reduced,
                            resolvedBy: report.resolveBy,
                            reason: report.resolveReason || 'Tài liệu vi phạm quy định'
                        });
                    }

                    violator.strike += 1;
                    violator.point -= point_reduced;
                    violator.rank_point -= point_reduced;
                    await violator.save();
                    await createPointTransaction(violator._id, "SPEND", point_reduced, `Bị trừ điểm do vi phạm quy định bình luận`);

                    if(violator.strike ==5 || violator.strike == 10){
                        await applyRestrictions(violator._id, report.resolveBy, 'LOGIN');
                    }
                } else {
                    // Xóa document
                    await Document.findByIdAndUpdate(report.doc, {
                        is_deleted: true,
                        deleted_at: new Date()
                    });

                    const document = await Document.findById(report.doc).populate('user');
                    if (document && document.user) {
                        await ViolationLog.create({
                            user: violatorId,
                            doc: report.doc,
                            cmt: null,
                            type: report.validTypes,
                            report: report._id,
                            strike: 1,
                            point_reduced: point_reduced,
                            resolvedBy: report.resolveBy,
                            reason: report.resolveReason || 'Tài liệu vi phạm quy định'
                        });
                    }

                    violator.strike += 1;
                    violator.point -= point_reduced;
                    violator.rank_point -= point_reduced;
                    await violator.save();
                    await createPointTransaction(violator._id, "SPEND", point_reduced, `Bị trừ điểm do vi phạm quy định đăng tài liệu`);

                    if(violator.strike ==5 || violator.strike == 10){
                        await applyRestrictions(violator._id, report.resolveBy, 'LOGIN');
                    }
                }
                break;

            case 'EDIT_REQUESTED':
                // Set document status về REQUESTED_EDIT để yêu cầu edit
                if (!report.cmt) {
                    await Document.findByIdAndUpdate(report.doc, {
                        status: 'REQUESTED_EDIT'
                    });

                    const document = await Document.findById(report.doc).populate('user');
                    if (document && document.user) {
                        await ViolationLog.create({
                            user: violatorId,
                            doc: report.doc,
                            cmt: null,
                            type: report.validTypes,
                            report: report._id,
                            strike: 1,
                            point_reduced: 0,
                            resolvedBy: report.resolveBy,
                            reason: report.resolveReason || 'Yêu cầu chỉnh sửa tài liệu'
                        });
                    }

                    violator.strike += 1;
                    await violator.save();

                    if(violator.strike ==5 || violator.strike == 10){
                        await applyRestrictions(violator._id, report.resolveBy, 'LOGIN');
                    }
                }
                break;

            case 'FALSE_REPORT':
                // Không làm gì cả
                break;

            default:
                throw new Error('Action không được hỗ trợ');
        }
    } catch (error) {
        throw new Error(`Lỗi xử lý action: ${error.message}`);
    }
};

const calculatePointReduction = (violationTypes, userStrikes) => {
  // Điểm trừ cơ bản theo loại vi phạm
  const basePointMap = {
    'COPYRIGHT': 10,
    'SPAM_OR_MISLEADING': 5, 
    'INAPPROPRIATE': 10,
    'DUPLICATE': 2,
    'INCORRECT_CATEGORY': 1,
    'PERSONAL_INFORMATION': 8,
    'LOW_QUALITY': 3,
    'OTHER': 2
  };
  
  let totalPoints = 0;
  
  // Tính điểm trừ cơ bản
  violationTypes.forEach(type => {
    totalPoints += basePointMap[type] || 0;
  });
  
  // Điểm trừ cảnh cáo theo số lần vi phạm
  let warningPenalty = 0;
  if (userStrikes === 0) {
    warningPenalty = 4; // Lần đầu
  } else if (userStrikes < 4) {
    warningPenalty = 10; // Các lần sau
  } else if (userStrikes >= 5 && userStrikes < 10) {
    warningPenalty = 20; // Lần thứ 5
  } else if (userStrikes >= 10) {
    warningPenalty = 999; // Trừ hết điểm (sẽ khóa vĩnh viễn)
  }
  
  return totalPoints + warningPenalty;
};

const applyRestrictions = async (userId, adminId, type ) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('Người dùng không tồn tại');
        }

        const account = await Account.findOne({ user: userId });
        if (!account) {
            throw new Error('Tài khoản không tồn tại');
        }

        // Xóa các restriction cũ để áp dụng mới
        await Restriction.updateMany(
            { account_id: account._id, status: 'ACTIVE' , type: type },
            { status: 'EXPIRED' }
        );

        if (user.strike >= 10) {
            // 10 strikes: Cấm vĩnh viễn
            await User.findByIdAndUpdate(userId, { 
                status: 'BANNED',
                rank_point: 0 
            });
            
            await Restriction.create({
                account_id: account._id,
                restricted_by: adminId,
                type: type,
                reason: 'Cấm vĩnh viễn do vi phạm quá 10 lần',
                startAt: new Date(),
                endAt: null // Vĩnh viễn
            });
        } else if (user.strike >= 5) {
            // 5 strikes: Khóa tài khoản tạm thời (30 ngày)
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
            
            await User.findByIdAndUpdate(userId, { status: 'INACTIVE' });
            
            await Restriction.create({
                account_id: account._id,
                restricted_by: adminId,
                type: type,
                reason: 'Khóa tạm thời 30 ngày do 5 vi phạm',
                startAt: new Date(),
                endAt: endDate
            });
        } 
    } catch (error) {
        throw new Error(`Lỗi áp dụng hạn chế: ${error.message}`);
    }
};