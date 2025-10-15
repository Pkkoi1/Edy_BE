const e = require("express");
const {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  getSubjectsByOrganization,
  searchSubjects,
} = require("../services/subject.service");

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
