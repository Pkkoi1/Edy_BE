const adminRoleService = require("../services/admin_role.service");

// ROLE CONTROLLERS
exports.getAllRoles = async (req, res) => {
  try {
    const accountId = req.user.accountId;
    const query = req.query;
    const roles = await adminRoleService.getAllRole(accountId, query);
    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const { roleId } = req.params;
    const accountId = req.user.accountId;
    const role = await adminRoleService.getRoleById(roleId, accountId);
    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createRole = async (req, res) => {
  try {
    const roleData = req.body;
    const accountId = req.user.accountId;
    const role = await adminRoleService.createRole(roleData, accountId);
    return res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const roleData = req.body;
    const accountId = req.user.accountId;
    const role = await adminRoleService.updateRole(roleId, roleData, accountId);
    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.changeRoleStatus = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: "is_active field is required",
      });
    }

    const accountId = req.user.accountId;
    const role = await adminRoleService.changeActiveRole(
      roleId,
      is_active,
      accountId
    );
    return res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const accountId = req.user.accountId;
    await adminRoleService.deleteRole(roleId, accountId);
    return res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ASSIGNMENT CONTROLLERS
exports.getAllAssignmentsByAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const reqAccountId = req.user.accountId;
    const assignments = await adminRoleService.getAllAssigmentByAccount(
      accountId,
      reqAccountId
    );
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllAssignmentsByRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const reqAccountId = req.user.accountId;
    const assignments = await adminRoleService.getAllAssigmentByRole(
      roleId,
      reqAccountId
    );
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const reqAccountId = req.user.accountId;
    const assignment = await adminRoleService.getAssignmentById(
      assignmentId,
      reqAccountId
    );
    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const assignmentData = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!assignmentData.account || !assignmentData.role) {
      return res.status(400).json({
        success: false,
        message: "Buộc phải có tài khoản và vai trò hợp lệ",
      });
    }
    const reqAccountId = req.user.accountId;
    const assignment = await adminRoleService.createAssignment(
      assignmentData,
      reqAccountId
    );
    return res.status(201).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignmentData = req.body;
    const reqAccountId = req.user.accountId;
    const assignment = await adminRoleService.updateAssignment(
      assignmentId,
      assignmentData,
      reqAccountId
    );
    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.changeAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: "is_active field is required",
      });
    }
    const reqAccountId = req.user.accountId;
    const assignment = await adminRoleService.changeActiveAssignment(
      assignmentId,
      is_active,
      reqAccountId
    );
    return res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const reqAccountId = req.user.accountId;
    await adminRoleService.deleteAssignment(assignmentId, reqAccountId);
    return res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// getAllAssignments
exports.getAllAssignments = async (req, res) => {
  try {
    const reqAccountId = req.user.accountId;
    const assignments = await adminRoleService.getAllAssignment(reqAccountId);
    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.revokeAllRoles = async (req, res) => {
  try {
    const { accountId } = req.params;
    if (!accountId) {
      return res
        .status(400)
        .json({ success: false, message: "accountId is required" });
    }

    const reqAccountId = req.user.accountId;
    const result = await adminRoleService.revokeAllRoles(
      accountId,
      reqAccountId
    );
    return res
      .status(200)
      .json({
        success: true,
        data: result,
        message: "Revoked all roles for the account",
      });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
