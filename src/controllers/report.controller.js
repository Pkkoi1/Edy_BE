const {
  createReport,
  getAllReports,
  resolveReport,
} = require("../services/report_service");
const { logReportResolved } = require("../services/recent_activities.service");

exports.createReport = async (req, res) => {
  try {
    const { docId, cmtId = null, type, reason } = req.body;
    const reporter = req.user.userId;

    const report = await createReport({ docId, cmtId, type, reason }, reporter);
    return res.status(201).json(report);
  } catch (error) {
    return res.status(400).json({ error: "Lỗi tạo báo cáo: " + error.message });
  }
};

exports.getAllReports = async (req, res) => {
  try {
    const filters = req.query;
    const reports = await getAllReports(filters);
    return res.status(200).json(reports);
  } catch (error) {
    return res
      .status(400)
      .json({ error: "Lỗi lấy danh sách báo cáo: " + error.message });
  }
};

exports.resolveReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const adminId = req.user.userId;
    const { validTypes, action, resolveReason } = req.body;

    const resolvedReport = await resolveReport(reportId, adminId, {
      validTypes,
      action,
      resolveReason,
    });

    // Log activity for report resolution
    await logReportResolved(reportId, adminId);

    return res.status(200).json(resolvedReport);
  } catch (error) {
    return res
      .status(400)
      .json({ error: "Lỗi xử lý báo cáo: " + error.message });
  }
};
