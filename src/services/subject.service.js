const Subject = require("../models/subject.model");
const Organization = require("../models/organization.model");
const Document = require("../models/document.model");

const createSubject = async (data) => {
  try {
    const newSubject = new Subject(data);

    const org = Organization.findById(data.organization);
    if (!org) {
      throw new Error("Tổ chức không tồn tại");
    }

    await newSubject.save();
    return newSubject;
  } catch (error) {
    throw error;
  }
};

const getAllSubjects = async () => {
  try {
    return await Subject.find().populate("created_by").populate("organization");
  } catch (error) {
    throw error;
  }
};

const getSubjectById = async (id) => {
  try {
    return await Subject.findById(id)
      .populate("created_by")
      .populate("organization");
  } catch (error) {
    throw error;
  }
};

const getSubjectsByOrganization = async (organizationId) => {
  try {
    return await Subject.find({ organization: organizationId })
      .populate({ path: "created_by", select: "_id name email avatar" })
      .populate({ path: "organization", select: "_id name" });
  } catch (error) {
    throw error;
  }
};

const updateSubject = async (id, data) => {
  try {
    return await Subject.findByIdAndUpdate(id, data, { new: true });
  } catch (error) {
    throw error;
  }
};

const deleteSubject = async (id) => {
  try {
    return await Subject.findByIdAndDelete(id);
  } catch (error) {
    throw error;
  }
};

const searchSubjects = async (keyword) => {
  try {
    const regex = new RegExp(keyword, "i"); // Case-insensitive search
    return await Subject.find({
      $or: [
        { name: { $regex: regex } },
        { code: { $regex: regex } },
        { description: { $regex: regex } },
      ],
      is_deleted: false,
    })
      .populate("created_by", "_id first_name last_name email")
      .populate("organization", "_id name");
  } catch (error) {
    throw error;
  }
};

const countApprovedDocuments = async (subjectId) => {
  try {
    const count = await Document.countDocuments({
      subject: subjectId,
      status: "APPROVED",
      is_deleted: false,
    });
    return count;
  } catch (error) {
    throw error;
  }
};

const syncSubjectDocCount = async (subjectId) => {
  try {
    // Đếm số tài liệu đã duyệt
    const actualCount = await countApprovedDocuments(subjectId);

    // Lấy thông tin môn học hiện tại
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      throw new Error("Môn học không tồn tại");
    }

    // So sánh và cập nhật nếu khác nhau
    if (subject.doc_count !== actualCount) {
      await Subject.findByIdAndUpdate(subjectId, { doc_count: actualCount });
      return {
        updated: true,
        oldCount: subject.doc_count,
        newCount: actualCount,
      };
    }

    return {
      updated: false,
      count: actualCount,
    };
  } catch (error) {
    throw error;
  }
};

const syncAllSubjectsDocCount = async () => {
  try {
    // Lấy tất cả môn học chưa bị xóa
    const subjects = await Subject.find({ is_deleted: false });
    const results = [];

    for (const subject of subjects) {
      try {
        const result = await syncSubjectDocCount(subject._id);
        if (result.updated) {
          results.push({
            subjectId: subject._id,
            subjectName: subject.name,
            oldCount: result.oldCount,
            newCount: result.newCount,
          });
        }
      } catch (error) {
        console.error(`Lỗi đồng bộ môn học ${subject._id}:`, error.message);
      }
    }

    return {
      totalSubjects: subjects.length,
      updatedSubjects: results.length,
      updatedList: results,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  getSubjectsByOrganization,
  searchSubjects,
  countApprovedDocuments,
  syncSubjectDocCount,
  syncAllSubjectsDocCount,
};
