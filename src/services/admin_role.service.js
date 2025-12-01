const Account = require("../models/account.model");
const Role = require("../models/role.model");
const Assignment = require("../models/assignment.model");

const updateAccountAdminStatus = async (accountId) => {
  const account = await Account.findById(accountId);
  if (!account) {
    throw new Error("Account not found");
  }
  const assignments = await Assignment.find({
    account: accountId,
    is_active: true,
  });
  if (assignments.length > 0) {
    account.is_admin = true;
  } else {
    account.is_admin = false;
  }
  await account.save();
  return account;
};

const hasManageRole = async (accountId) => {
  //chi role co MANAGE_ROLE va ALL moi duoc phep lay ra toan bo role
  const assignments = await Assignment.find({
    account: accountId,
    is_active: true,
  }).populate("role");
  // lấy ra role của người dùng, nếu người dùng hiện tại ko có role MANAGE ROLE hay ALL thì báo lỗi, ko thì trả toàn bộ role
  const userRoles = assignments.filter(
    (assignment) =>
      assignment.role.permissions.includes("MANAGE_ROLE") ||
      assignment.role.permissions.includes("ALL")
  );
  if (userRoles.length === 0) {
    throw new Error("User does not have permission to manage roles");
  }
  return true;
};

const getAllRole = async (accountId, query) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }

  // Build query object
  let searchQuery = { code: { $ne: "SUPER_ADMIN" } };

  // Combined search for name and code (regex, case insensitive)
  if (query.query) {
    searchQuery.$or = [
      { name: { $regex: query.query, $options: "i" } },
      { code: { $regex: query.query, $options: "i" } },
    ];
  }

  // Filter by description (regex, case insensitive)
  if (query.description) {
    searchQuery.description = { $regex: query.description, $options: "i" };
  }

  // Filter by permissions (array, using $in)
  if (query.permissions) {
    const permissionsArray = Array.isArray(query.permissions)
      ? query.permissions
      : [query.permissions];
    searchQuery.permissions = { $in: permissionsArray };
  }

  // Filter by is_active
  if (query.is_active !== undefined) {
    searchQuery.is_active =
      query.is_active === "true" || query.is_active === true;
  }

  return Role.find(searchQuery);
};

const getRoleById = async (roleId, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error("Role not found");
  }
  return role;
};

const updateRole = async (roleId, roleData, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  roleData.code = "CUSTOM_ROLE";
  const role = await Role.findByIdAndUpdate(roleId, roleData, { new: true });
  if (!role) {
    throw new Error("Role not found");
  }
  return role;
};

const changeActiveRole = async (roleId, active, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const role = await Role.findByIdAndUpdate(
    roleId,
    { is_active: active },
    { new: true }
  );
  if (!role) {
    throw new Error("Role not found");
  }

  // tắt role -> tự động tắt assignment liên quan
  if (active === false) {
    await Assignment.updateMany({ role: roleId }, { is_active: false });

    const accountsAffected = await Assignment.find({ role: roleId });
    for (const account of accountsAffected) {
      await updateAccountAdminStatus(account.account);
    }
  }

  return role;
};

const createRole = async (roleData, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const role = await Role.create(roleData);
  return role;
};

const deleteRole = async (roleId, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const role = await Role.findByIdAndDelete(roleId);
  if (!role) {
    throw new Error("Role not found");
  }
  return role;
};

const getAllAssigmentByAccount = async (accountId, accountRequestId) => {
  if (!(await hasManageRole(accountRequestId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignments = await Assignment.find({ account: accountId }).populate(
    "role"
  );
  return assignments;
};

const getAllAssigmentByRole = async (roleId, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignments = await Assignment.find({ role: roleId }).populate(
    "account"
  );
  return assignments;
};

const createAssignment = async (assignmentData, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  // fix chữa cháy
  let check = await Account.findById(assignmentData.account);
  if (!check) {
    check = await Account.find({ user: assignmentData.account });
    if (!check) {
      throw new Error("Account not found");
    }
    assignmentData.account = check[0]._id;
  }
  //kiểm tra coi account này đã có role này chưa
  const existingAssignment = await Assignment.findOne({
    account: assignmentData.account,
    role: assignmentData.role,
  });
  if (existingAssignment) {
    throw new Error("Account already has this role");
  }
  const assignment = await Assignment.create(assignmentData);
  await updateAccountAdminStatus(assignment.account);
  return assignment;
};

const changeActiveAssignment = async (assignmentId, active, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // không đc bật tắt super admin
  const role = await Role.findById(assignment.role);
  if (role.code === "SUPER_ADMIN") {
    throw new Error("Không được thao tác trên super admin");
  }

  // chỉ super admin mới đc bật tắt role có manage permission
  const currentAccountAssigment = await Assignment.find({ account: accountId });
  const currentAccountIsSUperAdmin = currentAccountAssigment.some(
    (assigment) => assigment.role.code === "SUPER_ADMIN"
  );
  if (!currentAccountIsSUperAdmin && role.permissions.includes("MANAGE_ROLE")) {
    throw new Error(
      "Phân quyền này chứa quản lý vai trò và chỉ super admin mới được phép chỉnh sửa"
    );
  }

  if (active == true) {
    //khi bật lại assignment, phải kiểm tra role có active hay không
    const role = await Role.findById(assignment.role);
    if (!role || !role.is_active) {
      throw new Error("Role is not active");
    }
  }

  const updatedAssignment = await Assignment.findByIdAndUpdate(
    assignmentId,
    { is_active: active },
    { new: true }
  );
  await updateAccountAdminStatus(assignment.account);

  return updatedAssignment;
};

const deleteAssignment = async (assignmentId, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignment = await Assignment.findByIdAndDelete(assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }
  //xoa assignment thi cap nhat lai account is_admin
  await updateAccountAdminStatus(assignment.account);
  return assignment;
};

const updateAssignment = async (assignmentId, assignmentData, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignment = await Assignment.findByIdAndUpdate(
    assignmentId,
    assignmentData,
    { new: true }
  );
  if (!assignment) {
    throw new Error("Assignment not found");
  }
  await updateAccountAdminStatus(assignment.account);
  return assignment;
};

const getAssignmentById = async (assignmentId, accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignment = await Assignment.findById(assignmentId)
    .populate("account")
    .populate("role");
  if (!assignment) {
    throw new Error("Assignment not found");
  }
  return assignment;
};

const getAllAssignment = async (accountId) => {
  if (!(await hasManageRole(accountId))) {
    throw new Error("User does not have permission to manage roles");
  }
  const assignments = await Assignment.find()
    .populate({
      path: "account",
      populate: {
        path: "user",
        select: "_id first_name last_name avatar",
      },
    })
    .populate({
      path: "role",
      select: "_id name is_active code",
    })
    .populate({
      path: "subject",
      select: "_id name",
    })
    .populate({
      path: "organization",
      select: "_id name",
    });
  // lọc ra ko được hiện role code SUPER_ADMIN
  const filteredAssignments = assignments.filter(
    (assignment) => assignment.role.code !== "SUPER_ADMIN"
  );
  // Nhóm lại theo account, mỗi account sẽ có danh sách các role và thông tin liên quan
  const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
    const accountId = assignment.account._id;

    if (!acc[accountId]) {
      acc[accountId] = {
        account: {
          _id: assignment.account._id,
          username: assignment.account.username,
          user: {
            fullname: `${assignment.account.user.first_name} ${assignment.account.user.last_name}`,
            avatar: assignment.account.user.avatar,
            id: assignment.account.user._id,
          },
        },
        assignments: [],
      };
    }

    acc[accountId].assignments.push({
      _id: assignment._id,
      role: {
        _id: assignment.role._id,
        name: assignment.role.name,
        is_active: assignment.role.is_active,
      },
      subject: assignment.subject
        ? {
            _id: assignment.subject._id,
            name: assignment.subject.name,
          }
        : null,
      organization: assignment.organization
        ? {
            _id: assignment.organization._id,
            name: assignment.organization.name,
          }
        : null,
      is_active: assignment.is_active,
    });

    return acc;
  }, {});

  // Chuyển đổi từ object sang array để dễ xử lý ở frontend
  return Object.values(groupedAssignments);
};

const revokeAllRoles = async (accountIdToRevoke, requesterAccountId) => {
  // chỉ người có quyền MANAGE_ROLE mới được thao tác
  if (!(await hasManageRole(requesterAccountId))) {
    throw new Error("User does not have permission to manage roles");
  }

  // tải các assignment của target và requester để kiểm tra SUPER_ADMIN
  const targetAssignments = await Assignment.find({
    account: accountIdToRevoke,
  }).populate("role");
  const requesterAssignments = await Assignment.find({
    account: requesterAccountId,
  }).populate("role");

  const targetIsSuperAdmin = targetAssignments.some(
    (a) => a.role && a.role.code === "SUPER_ADMIN"
  );
  const requesterIsSuperAdmin = requesterAssignments.some(
    (a) => a.role && a.role.code === "SUPER_ADMIN"
  );

  // Không cho phép tước role của SUPER_ADMIN trừ khi requester cũng là SUPER_ADMIN
  if (targetIsSuperAdmin && !requesterIsSuperAdmin) {
    throw new Error("Cannot revoke roles from SUPER_ADMIN");
  }

  // Xóa tất cả assignments của người dùng
  const deleteResult = await Assignment.deleteMany({
    account: accountIdToRevoke,
  });

  // Cập nhật lại trạng thái is_admin cho tài khoản (sẽ false nếu không còn assignment nào)
  await updateAccountAdminStatus(accountIdToRevoke);

  return { deletedCount: deleteResult.deletedCount || 0 };
};

module.exports = {
  getAllRole,
  getRoleById,
  updateRole,
  changeActiveRole,
  createRole,
  deleteRole,
  getAllAssigmentByAccount,
  getAllAssigmentByRole,
  createAssignment,
  changeActiveAssignment,
  deleteAssignment,
  updateAssignment,
  getAssignmentById,
  getAllAssignment,
  revokeAllRoles,
};
