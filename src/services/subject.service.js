const Subject = require('../models/subject.model');
const Organization = require('../models/organization.model');

const createSubject = async (data) => {
  try {
    const newSubject = new Subject(data);
    
    const org = Organization.findById(data.organization);
    if (!org) {
      throw new Error('Tổ chức không tồn tại');
    }
    
    await newSubject.save();
    return newSubject;
  } catch (error) {
    throw error;
  }
};

const getAllSubjects = async () => {
  try {
    return await Subject.find().populate('created_by').populate('organization');
  } catch (error) {
    throw error;
  }
};

const getSubjectById = async (id) => {
  try {
    return await Subject.findById(id).populate('created_by').populate('organization');
  } catch (error) {
    throw error;
  }
};

const getSubjectsByOrganization = async (organizationId) => {
  try {
    return await Subject.find({ organization: organizationId })
      .populate({path: 'created_by', select: '_id name email avatar'})
      .populate({path: 'organization', select: '_id name'});
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

module.exports = {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
getSubjectsByOrganization
};