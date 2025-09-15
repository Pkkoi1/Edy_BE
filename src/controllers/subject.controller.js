const e = require('express');
const {getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject, getSubjectsByOrganization} = require('../services/subject.service');

exports.createSubject = async (req, res) => {
  try {
    const { name, code, description, organization } = req.body;
    const subject = await createSubject({
      name,
      code,
      description,
      organization,
      created_by: req.user.userId
    });
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSubjectsByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const subjects = await getSubjectsByOrganization(organizationId);
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

