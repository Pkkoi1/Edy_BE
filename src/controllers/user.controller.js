const User = require('../models/user.model');
const Account = require('../models/account.model');
const Assignment = require('../models/assignment.model');
const Organization = require('../models/organization.model');
const Role = require('../models/role.model');
const mongoose = require('mongoose');

exports.getUsers = async (req, res) => {
    try{
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message }) 
    }
};

exports.verifyUser = async (req, res) => {
    try {
      const { field_of_study, organization } = req.body;
  
      let fieldOfStudyArray = [];
      if (Array.isArray(field_of_study)) {
        fieldOfStudyArray = field_of_study;
      } else {
        fieldOfStudyArray = field_of_study
          ? field_of_study.split(',').map(s => s.trim()).filter(s => s)
          : [];
      }
      
      if (!mongoose.Types.ObjectId.isValid(organization)) {
        return res.status(404).json({ message: "Không tìm thấy tổ chức" });
      }
      const existingOrganization = await Organization.findById(organization);
      if (!existingOrganization) {
        return res.status(404).json({ message: "Không tìm thấy tổ chức" });
      }
  
      const user = await User.findById(req.user.userId);
      user.field_of_study = fieldOfStudyArray;
      user.organization = organization;
      await user.save();

      const account = await Account.findById(req.user.accountId);
      account.is_verified = true;
      await account.save();
  
      res.json({ message: "Thêm thông tin thành công" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Đã xảy ra lỗi khi thêm thông tin" });
    }
  }