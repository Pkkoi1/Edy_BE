const e = require("express");
const {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsByOrganization,
  searchSubjects,
  countApprovedDocuments,
  syncSubjectDocCount,
  syncAllSubjectsDocCount,
} = require("../services/subject.service");
const { logSubjectCreated } = require("../services/recent_activities.service");

exports.createSubject = async (req, res) => {
  try {
    const { name, code, description, organization } = req.body;
    const subject = await createSubject({
      name,
      code,
      description,
      organization,
      created_by: req.user.userId,
    });

    // Log activity for subject creation
    await logSubjectCreated(subject._id, req.user.userId);

    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSubjectById = async (req, res) => {
  try {
    const subject = await getSubjectById(req.params.id);
    if (!subject) {
      return res.status(404).json({ error: "Môn học không tồn tại" });
    }
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSubjectsByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.query;
    const subjects = await getSubjectsByOrganization(organizationId);
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchSubjects = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword || typeof keyword !== "string") {
      return res
        .status(400)
        .json({ error: "Keyword must be a non-empty string" });
    }

    const subjects = await searchSubjects(keyword.trim());
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, organization } = req.body;

    const subject = await updateSubject(id, {
      name,
      code,
      description,
      organization,
    });

    if (!subject) {
      return res.status(404).json({ error: "Môn học không tồn tại" });
    }

    res.status(200).json({
      message: "Cập nhật môn học thành công",
      subject,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await deleteSubject(id);

    if (!subject) {
      return res.status(404).json({ error: "Môn học không tồn tại" });
    }

    res.status(200).json({
      message: "Xóa môn học thành công",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.syncSubjectDocCount = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await syncSubjectDocCount(id);

    if (result.updated) {
      res.status(200).json({
        message: "Đã đồng bộ số lượng tài liệu",
        old_count: result.oldCount,
        new_count: result.newCount,
      });
    } else {
      res.status(200).json({
        message: "Số lượng tài liệu đã chính xác",
        count: result.count,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.syncAllSubjectsDocCount = async (req, res) => {
  try {
    const result = await syncAllSubjectsDocCount();

    res.status(200).json({
      message: "Đã đồng bộ tất cả môn học",
      total_subjects: result.totalSubjects,
      updated_subjects: result.updatedSubjects,
      updated_list: result.updatedList,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
