const AccessRequest = require("../models/access_request.model");
const PrivateShare = require("../models/private_share.model");
const Document = require("../models/document.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const { notifyNewAccessRequest } = require("./notification.service");

/**
 * Tạo yêu cầu truy cập tài liệu qua private share
 */
const createAccessRequest = async (privateShareId, userId, content = null) => {
  try {
    // Kiểm tra private share tồn tại và đang hoạt động
    const privateShare = await PrivateShare.findOne({
      _id: privateShareId,
      status: "ACTIVE",
    }).populate("doc");

    if (!privateShare) {
      throw new Error("Link chia sẻ không tồn tại hoặc đã bị vô hiệu hóa");
    }

    // Kiểm tra thời gian hết hạn
    if (privateShare.time_limited) {
      const now = new Date();
      if (now < privateShare.start_date || now > privateShare.end_date) {
        throw new Error("Link chia sẻ đã hết thời gian truy cập");
      }
    }

    // Kiểm tra giới hạn số lượng truy cập
    if (privateShare.limited_access !== null) {
      const currentAccessCount = await AccessRequest.countDocuments({
        private_share: privateShareId,
        status: "APPROVED",
      });

      if (currentAccessCount >= privateShare.limited_access) {
        throw new Error("Link chia sẻ đã đạt giới hạn số lượng truy cập");
      }
    }

    // Kiểm tra user đã gửi yêu cầu chưa
    const existingRequest = await AccessRequest.findOne({
      private_share: privateShareId,
      user: userId,
      status: { $in: ["PENDING", "APPROVED"] },
    });

    if (existingRequest) {
      if (existingRequest.status === "APPROVED") {
        throw new Error("Bạn đã có quyền truy cập tài liệu này");
      }
      if (existingRequest.status === "PENDING") {
        throw new Error("Bạn đã gửi yêu cầu truy cập, vui lòng chờ phê duyệt");
      }
    }

    // Kiểm tra user không phải là chủ sở hữu tài liệu
    if (privateShare.doc.user.toString() === userId) {
      throw new Error(
        "Bạn không thể gửi yêu cầu truy cập tài liệu của chính mình"
      );
    }

    // Tạo access request mới
    const accessRequest = new AccessRequest({
      doc: privateShare.doc._id,
      user: userId,
      private_share: privateShareId,
      content,
      expiredAt: privateShare.time_limited ? privateShare.end_date : null,
    });

    await accessRequest.save();

    // Populate thông tin để trả về
    await accessRequest.populate([
      { path: "user", select: "first_name last_name email avatar" },
      { path: "doc", select: "title doc_type" },
      { path: "private_share", select: "name" },
    ]);


    const ownerId = privateShare.doc.user.toString();
    const docId = privateShare.doc._id.toString();
    const requesterName = `${accessRequest.user.first_name} ${accessRequest.user.last_name}`.trim();
    const privateShareName = privateShare.name || null;
    await notifyNewAccessRequest(ownerId, docId, requesterName, privateShareName);

    return accessRequest;

  } catch (err) {
    throw new Error("Lỗi tạo yêu cầu truy cập: " + err.message);
  }
};

/**
 * Lấy danh sách yêu cầu truy cập theo private share
 */
const getAccessRequestsByPrivateShare = async (
  privateShareId,
  ownerId,
  filters = {}
) => {
  // Kiểm tra private share tồn tại
  const privateShare = await PrivateShare.findById(privateShareId);

  if (!privateShare) {
    throw new Error("Link chia sẻ không tồn tại");
  }

  const {
    status,
    page = 1,
    limit = 10,
    ordering = "createdAt",
    order = -1,
  } = filters;

  const skip = (page - 1) * limit;

  // Tạo query
  const query = {
    private_share: privateShareId,
    status: { $ne: 'IGNORED' }
  };
  if (status) {
    query.status = status;
  }

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [requests, total] = await Promise.all([
    AccessRequest.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate([
        {
          path: "user",
          select: "first_name last_name contact_email avatar organization",
        },
        { path: "doc", select: "title doc_type" },
      ]),
    AccessRequest.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;

  return {
    requests,
    total,
    page,
    totalPages,
    have_next,
    privateShare: {
      _id: privateShare._id,
      name: privateShare.name,
      limited_access: privateShare.limited_access,
      current_access_count: await AccessRequest.countDocuments({
        private_share: privateShareId,
        status: "APPROVED",
      }),
    },
  };
};

/**
 * Phê duyệt yêu cầu truy cập
 */
const approveAccessRequest = async (requestId, ownerId) => {
  const accessRequest = await AccessRequest.findById(requestId).populate([
    { path: "private_share" },
    { path: "user" },
    { path: "doc", populate: { path: "user" } },
  ]);

  current = new Date();
  if (!accessRequest) {
    throw new Error("Yêu cầu truy cập không tồn tại");
  }

  // Kiểm tra quyền sở hữu thông qua chủ sở hữu tài liệu
  if (accessRequest.doc.user._id.toString() !== ownerId) {
    throw new Error("Bạn không có quyền phê duyệt yêu cầu này");
  }

  // Kiểm tra trạng thái hiện tại
  if (accessRequest.status !== "PENDING") {
    throw new Error("Yêu cầu đã được xử lý trước đó");
  }

  // Kiểm tra giới hạn số lượng truy cập
  const privateShare = accessRequest.private_share;
  if (privateShare.limited_access !== null) {
    const currentAccessCount = await AccessRequest.countDocuments({
      private_share: privateShare._id,
      status: "APPROVED",
    });

    if (currentAccessCount >= privateShare.limited_access) {
      throw new Error("Link chia sẻ đã đạt giới hạn số lượng truy cập");
    }
  }

  // Cập nhật trạng thái
  accessRequest.status = "APPROVED";
  await accessRequest.save();

  // Cập nhật các pending request của người yêu cầu chỉa vào cùng 1 doc
  await AccessRequest.updateMany(
    {
      user: accessRequest.user._id,
      doc: accessRequest.doc._id,
      status: "PENDING",
    },
    {
      status: "IGNORED",
      expiredAt: new Date() + 3 * 24 * 60 * 60 * 1000
    }
  );

  // Thêm tài liệu vào danh sách shared_documents của user
  const user = await User.findById(accessRequest.user._id);
  if (user) {
    const existingShare = user.shared_documents?.find(
      (item) => item.document.toString() === accessRequest.doc._id.toString()
    );

    if (!existingShare) {
      if (!user.shared_documents) {
        user.shared_documents = [];
      }
      user.shared_documents.push({
        document: accessRequest.doc._id,
        shared_at: current,
      });
      await user.save();
    }
  }

  // Thêm user vào danh sách user_accessed của PrivateShare
  const updatedPrivateShare = await PrivateShare.findById(privateShare._id);
  if (
    updatedPrivateShare &&
    !updatedPrivateShare.user_accessed.includes(accessRequest.user._id)
  ) {
    updatedPrivateShare.user_accessed.push(accessRequest.user._id);
    await updatedPrivateShare.save();
  }

  return accessRequest;
};

/**
 * Từ chối yêu cầu truy cập
 */
const denyAccessRequest = async (requestId, ownerId) => {
  const accessRequest = await AccessRequest.findById(requestId).populate([
    { path: "private_share" },
    { path: "user" },
    { path: "doc", populate: { path: "user" } },
  ]);

  if (!accessRequest) {
    throw new Error("Yêu cầu truy cập không tồn tại");
  }

  // Kiểm tra quyền sở hữu thông qua chủ sở hữu tài liệu
  if (accessRequest.doc.user._id.toString() !== ownerId) {
    throw new Error("Bạn không có quyền từ chối yêu cầu này");
  }

  // Kiểm tra trạng thái hiện tại
  if (accessRequest.status !== "PENDING") {
    throw new Error("Yêu cầu đã được xử lý trước đó");
  }

  // Cập nhật trạng thái
  accessRequest.status = "DENIED";
  accessRequest.expiredAt = new Date() + 7 * 24 * 60 * 60 * 1000;
  await accessRequest.save();

  return accessRequest;
};

/**
 * Lấy danh sách yêu cầu của một user
 */
const getMyAccessRequests = async (userId, filters = {}) => {
  const {
    status,
    page = 1,
    limit = 10,
    ordering = "createdAt",
    order = -1,
  } = filters;

  const skip = (page - 1) * limit;

  // Tạo query
  const query = { user: userId };
  if (status) {
    query.status = status;
  }

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [requests, total] = await Promise.all([
    AccessRequest.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate([
        { path: "doc", select: "title doc_type author" },
        {
          path: "private_share",
          select: "name",
          populate: { path: "user", select: "first_name last_name" },
        },
      ]),
    AccessRequest.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;

  return {
    requests,
    total,
    page,
    totalPages,
    have_next,
  };
};

module.exports = {
  createAccessRequest,
  getAccessRequestsByPrivateShare,
  approveAccessRequest,
  denyAccessRequest,
  getMyAccessRequests,
};