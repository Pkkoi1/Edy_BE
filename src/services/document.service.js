const Document = require("../models/document.model");
const User = require("../models/user.model");
const Account = require("../models/account.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
const DownloadLink = require("../models/download_link.model");
const { updateUserDocCount } = require("./user.service");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const getNewestDocuments = async ({
  payload,
  search,
  ordering = "last_approved_at",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  let user = null;
  let sharedDocIds = [];
  if (payload && payload.userId) {
    user = await User.findById(payload.userId).select(
      "organization shared_documents"
    );
    if (user && user.shared_documents && user.shared_documents.length > 0) {
      sharedDocIds = user.shared_documents.map((item) => item.document);
    }
  }

  const skip = (page - 1) * limit;

  // Điều kiện quyền truy cập
  let accessOr = [];
  if (user && user.organization) {
    accessOr = [
      { public_mode: "PUBLIC" },
      { public_mode: "SHARE_ORGANIZATION", organization: user.organization },
      { user: user._id },
    ];
    if (sharedDocIds.length > 0) {
      accessOr.push({ _id: { $in: sharedDocIds } });
    }
  } else {
    accessOr = [{ public_mode: "PUBLIC" }];
  }

  // Điều kiện tìm kiếm
  let searchOr = [];
  if (search) {
    searchOr = [
      { title: { $regex: search, $options: "i" } },
      { author: { $elemMatch: { $regex: search, $options: "i" } } },
      { keyword: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  // Kết hợp quyền truy cập và tìm kiếm
  let query = { status: "APPROVED", is_deleted: false };
  if (searchOr.length > 0) {
    query.$and = [{ $or: accessOr }, { $or: searchOr }, { is_deleted: false }];
  } else {
    query.$or = accessOr;
  }

  // Filter các trường
  const filterFields = [
    "organization",
    "publisher",
    "published_year",
    "intensive",
    "author",
    "user",
    "keyword",
    "doc_type",
    "level",
    "subject",
  ];

  filterFields.forEach((field) => {
    if (filters[field] !== undefined) {
      // Nếu là array (author, keyword), dùng $in
      if (Array.isArray(filters[field])) {
        query[field] = { $in: filters[field] };
      } else {
        query[field] = filters[field];
      }
    }
  });

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author cover_page published_year publisher page file_type intensive url organization subject level view download_count comment_count createdAt last_approved_at"
      )
      .populate({
        path: "user",
        select: "_id first_name last_name avatar doc_count",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .populate({ path: "organization", select: "_id name" })
      .populate({ path: "subject", select: "_id name" }),
    Document.countDocuments(query),
  ]);
  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;
  return {
    documents,
    total,
    page,
    totalPages,
    have_next,
  };
};

const getDocumentsBySubject = async ({
  subject,
  payload,
  search,
  ordering = "createdAt",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  const isValidSubject = await validateSubjects(subject);
  if (!isValidSubject) {
    throw new Error("Môn học không hợp lệ");
  }

  let user = null;
  let sharedDocIds = [];
  if (payload && payload.userId) {
    user = await User.findById(payload.userId).select(
      "organization shared_documents"
    );
    if (user && user.shared_documents && user.shared_documents.length > 0) {
      sharedDocIds = user.shared_documents.map((item) => item.document);
    }
  }

  const skip = (page - 1) * limit;

  // Điều kiện quyền truy cập
  let accessOr = [];
  if (user && user.organization) {
    accessOr = [
      { public_mode: "PUBLIC" },
      { public_mode: "SHARE_ORGANIZATION", organization: user.organization },
      { user: user._id },
    ];
    if (sharedDocIds.length > 0) {
      accessOr.push({ _id: { $in: sharedDocIds } });
    }
  } else {
    accessOr = [{ public_mode: "PUBLIC" }];
  }

  // Điều kiện tìm kiếm
  let searchOr = [];
  if (search) {
    searchOr = [
      { title: { $regex: search, $options: "i" } },
      { author: { $elemMatch: { $regex: search, $options: "i" } } },
      { keyword: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  // Kết hợp quyền truy cập, tìm kiếm và lọc subject
  let query = {
    status: "APPROVED",
    is_deleted: false,
    subject,
  };
  if (searchOr.length > 0) {
    query.$and = [
      { $or: accessOr },
      { $or: searchOr },
      { subject },
      { is_deleted: false },
    ];
  } else {
    query.$or = accessOr;
    query.subject = subject;
  }

  // Filter các trường khác
  const filterFields = [
    "organization",
    "publisher",
    "published_year",
    "intensive",
    "author",
    "user",
    "keyword",
    "doc_type",
    "level",
  ];

  filterFields.forEach((field) => {
    if (filters[field] !== undefined) {
      if (Array.isArray(filters[field])) {
        query[field] = { $in: filters[field] };
      } else {
        query[field] = filters[field];
      }
    }
  });

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author published_year publisher page file_type intensive url organization subject level view download_count doc_type comment_count createdAt"
      )
      .populate({
        path: "user",
        select: "_id first_name last_name avatar doc_count",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .populate({ path: "organization", select: "_id name" })
      .populate({ path: "subject", select: "_id name" }),
    Document.countDocuments(query),
  ]);
  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;
  return {
    documents,
    total,
    page,
    totalPages,
    have_next,
  };
};

const getMyDocuments = async ({
  payload,
  search,
  ordering = "createdAt",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  if (!payload || !payload.userId) {
    throw new Error("Người dùng chưa đăng nhập");
  }
  let user = await User.findById(payload.userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }
  const skip = (page - 1) * limit;

  // Điều kiện tìm kiếm
  let searchOr = [];
  if (search) {
    searchOr = [
      { title: { $regex: search, $options: "i" } },
      { author: { $elemMatch: { $regex: search, $options: "i" } } },
      { keyword: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  //chỉ lấy document của user hiện tại
  let query = {
    user: user._id,
    is_deleted: false,
  };

  // Thêm điều kiện search nếu có
  if (searchOr.length > 0) {
    query.$and = [{ user: user._id }, { $or: searchOr }, { is_deleted: false }];
  }

  // Filter các trường
  const filterFields = [
    "organization",
    "publisher",
    "published_year",
    "intensive",
    "author",
    "keyword",
    "doc_type",
    "level",
    "subject",
    "status",
    "summary_status",
    "public_mode",
  ];

  filterFields.forEach((field) => {
    if (filters[field] !== undefined) {
      if (Array.isArray(filters[field])) {
        query[field] = { $in: filters[field] };
      } else {
        query[field] = filters[field];
      }
    }
  });

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count status summary_status public_mode createdAt"
      )
      .populate({
        path: "user",
        select: "_id first_name last_name avatar doc_count",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .populate({ path: "organization", select: "_id name" })
      .populate({ path: "subject", select: "_id name" }),
    Document.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;
  return {
    documents,
    total,
    page,
    totalPages,
    have_next,
  };
};

// const getDocumentsAccessible = async (user, page = 1, limit = 5)

const getCoverPage = (url) => {
  // Ví dụ với file PDF
  if (!url) return null;
  return cloudinary.url(url, { page: 1, format: "jpg" });
};

const createDocument = async (data) => {
  const docData = {
    ...data,
    cover_page: data.cover_page || getCoverPage(data.url),
  };

  if (
    data.organization &&
    !mongoose.Types.ObjectId.isValid(data.organization)
  ) {
    throw new Error("ID tổ chức không hợp lệ");
  }
  const organization = data.organization
    ? await Organization.findById(data.organization)
    : null;
  if (data.organization && !organization) {
    throw new Error("Tổ chức không tồn tại");
  }

  if (data.subject && !mongoose.Types.ObjectId.isValid(data.subject)) {
    throw new Error("ID môn học không hợp lệ");
  }
  const subject = data.subject ? await Subject.findById(data.subject) : null;
  if (!subject) {
    throw new Error("Môn học không tồn tại");
  }
  const doc = new Document(docData);
  await doc.save();

  // Cập nhật số lượng tài liệu của user
  await updateUserDocCount(data.user);

  return doc;
};

const deleteDocument = async (id) => {
  const doc = await Document.findByIdAndUpdate(
    id,
    { is_deleted: true },
    { new: true }
  );

  // Cập nhật số lượng tài liệu của user
  if (doc && doc.user) {
    await updateUserDocCount(doc.user);
  }

  return doc;
};

const updateDocument = async (id, data) => {
  // Không cho sửa trường is_deleted qua update này
  if ("is_deleted" in data) delete data.is_deleted;
  const doc = await Document.findByIdAndUpdate(id, data, { new: true });
  return doc;
};

const getDocumentById = async (id, userId) => {
  const doc = await Document.findOne({ _id: id, is_deleted: false })
    .populate({
      path: "user",
      select:
        "_id first_name last_name avatar organization follower following doc_count",
      populate: {
        path: "organization",
        select: "_id name",
      },
    })
    .populate({ path: "organization", select: "_id name" })
    .populate({ path: "subject", select: "_id name" });

  const canView = await canViewDocument(userId, id);
  const isAdmin = await Account.findOne({ user: userId, is_admin: true });
  if (!canView && !isAdmin) {
    throw new Error("Bạn không có quyền truy cập tài liệu này");
  }

  if (canView) {
    if (!isAdmin) {
      if (doc && doc.summary_status !== "APPROVED") {
        if (
          doc.description &&
          (doc.summary_status !== "REJECTED" || doc.summary_status !== "NONE")
        ) {
          doc.description.summary_by_user =
            "Tài liệu không được tóm tắt bởi người đăng.";
        }
        if (
          doc.description &&
          (doc.summary_status == "PENDING" ||
            doc.summary_status == "PENDING_EDIT")
        ) {
          doc.description.summary_by_user =
            "Tóm tắt đang chờ phê duyệt, hãy kiên nhẫn để admin duyệt bạn nhé!";
        }
      }
    }
  }

  return doc;
};

const getPendingDocuments = async ({
  payload,
  search,
  ordering = "createdAt",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  const skip = (page - 1) * limit;

  // Điều kiện tìm kiếm
  let searchOr = [];
  if (search) {
    searchOr = [
      { title: { $regex: search, $options: "i" } },
      { author: { $elemMatch: { $regex: search, $options: "i" } } },
      { keyword: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  // Query cơ bản cho pending documents
  let query = {
    $or: [{ status: "PENDING" }, { summary_status: "PENDING" }],
    is_deleted: false,
  };

  // Thêm điều kiện search nếu có
  if (searchOr.length > 0) {
    query.$and = [
      {
        $or: [{ status: "PENDING" }, { summary_status: "PENDING" }],
      },
      { $or: searchOr },
      { is_deleted: false },
    ];
  }

  // Filter các trường
  const filterFields = [
    "organization",
    "publisher",
    "published_year",
    "intensive",
    "author",
    "user",
    "keyword",
    "doc_type",
    "level",
    "subject",
  ];

  filterFields.forEach((field) => {
    if (filters[field] !== undefined) {
      if (Array.isArray(filters[field])) {
        query[field] = { $in: filters[field] };
      } else {
        query[field] = filters[field];
      }
    }
  });

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count status summary_status createdAt"
      )
      .populate({
        path: "user",
        select: "_id first_name last_name avatar organization doc_count",
        populate: {
          path: "organization",
          select: "_id name",
        },
      })
      .populate({ path: "organization", select: "_id name" })
      .populate({ path: "subject", select: "_id name" }),
    Document.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;
  return {
    documents,
    total,
    page,
    totalPages,
    have_next,
  };
};

const createDownloadLink = async (userId, documentId) => {
  const currentTime = new Date();
  // Kiểm tra quyền xem tài liệu
  const canView = await canViewDocument(userId, documentId);
  if (!canView) {
    throw new Error("Bạn không có quyền truy cập tài liệu này");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }

  const existingLink = await DownloadLink.findOne({
    user: userId,
    doc: documentId,
    status: "PENDING",
  });

  // if (existingLink && existingLink.expiredAt > currentTime) {
  //   throw new Error(
  //     `Bạn đã có một link tải tài liệu đang chờ sử dụng. Vui lòng sử dụng link cũ hoặc đợi link hết hạn vào ${existingLink.expiredAt.toLocaleString()}.`
  //   );
  // }

  const type = user.free_download_count > 0 ? "FREE" : "POINT";
  const cost = type === "FREE" ? 0 : await getDownloadPrice(documentId, user);
  if (type === "POINT" && user.point < cost) {
    throw new Error(
      `Không đủ điểm để tải tài liệu. Tài liệu cần ${cost} điểm, bạn hiện có ${user.point} điểm.`
    );
  }

  //Tạo download link

  let expiredAt = new Date(currentTime.getTime() + 10 * 60 * 1000);
  const downloadLink = new DownloadLink({
    user: userId,
    doc: documentId,
    type,
    cost,
    status: "PENDING",
    expiredAt,
  });

  await downloadLink.save();

  let remaining_free_downloads =
    type === "FREE" ? user.free_download_count - 1 : user.free_download_count;
  return {
    downloadId: downloadLink._id,
    url: `/download/${downloadLink._id}`,
    type,
    cost,
    expiredAt,
    expiresIn: "10 phút",
    free_downloads_remaining: remaining_free_downloads,
  };
};

const processDownload = async (downloadId, userId) => {
  const downloadLink = await DownloadLink.findById(downloadId)
    .populate("user")
    .populate("doc");

  if (!downloadLink) {
    throw new Error("Link download không tồn tại");
  }

  if (downloadLink.user._id.toString() !== userId) {
    throw new Error("Bạn không có quyền sử dụng link này");
  }

  if (downloadLink.status === "SUCCESS") {
    throw new Error("Link này đã được sử dụng");
  }

  if (
    downloadLink.status === "EXPIRED" ||
    new Date() > downloadLink.expiredAt
  ) {
    downloadLink.status = "EXPIRED";
    await downloadLink.save();
    throw new Error("Link download đã hết hạn");
  }

  const user = downloadLink.user;
  const document = downloadLink.doc;

  // Tính điểm
  if (downloadLink.type === "FREE") {
    user.free_download_count = Math.max(0, user.free_download_count - 1);
  } else {
    user.point = Math.max(0, user.point - downloadLink.cost);
  }

  // Cập nhật download count status
  document.download_count = (document.download_count || 0) + 1;

  await Promise.all([user.save(), document.save(), downloadLink.save()]);

  return {
    downloadUrl: document.url,
    filename: `${document.title}.${getFileExtension(document.file_type)}`,
    document: {
      id: document._id,
      title: document.title,
      author: document.author,
    },
    remaining_free_downloads: user.free_download_count,
  };
};

const markDownloadSuccess = async (downloadId) => {
  const downloadLink = await DownloadLink.findById(downloadId);
  if (!downloadLink) {
    throw new Error("Link download không tồn tại");
  }
  if (downloadLink.status !== "PENDING") {
    throw new Error("Link download không ở trạng thái chờ");
  }
  downloadLink.status = "SUCCESS";
  downloadLink.accessedAt = new Date();
  await downloadLink.save();
  return downloadLink;
};

module.exports = {
  getNewestDocuments,
  createDocument,
  deleteDocument,
  updateDocument,
  getDocumentById,
  getDocumentsBySubject,
  getPendingDocuments,
  getMyDocuments,
  createDownloadLink,
  processDownload,
  markDownloadSuccess,
};

const validateSubjects = async (subjectId) => {
  if (!mongoose.Types.ObjectId.isValid(subjectId)) {
    return false;
  }

  const subject = await Subject.findById(subjectId);
  return !!subject;
};

const validateOrganization = async (organizationId) => {
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    return false;
  }

  const organization = await Organization.findById(organizationId);
  return !!organization;
};

// function check quyen xem doc
const canViewDocument = async (userId, documentId) => {
  const document = await Document.findOne({
    _id: documentId,
    is_deleted: false,
  }).populate("user organization");

  if (!document) return false;

  const user = await User.findById(userId).populate("organization");
  if (!user) {
    if (document.public_mode === "PUBLIC") return true;
    else return false;
  }

  // Document phải được approve
  if (document.status !== "APPROVED") {
    // Chỉ chủ sở hữu mới xem được document chưa approve
    return document.user._id.toString() === userId;
  }

  // Check quyền truy cập theo public mode
  switch (document.public_mode) {
    case "PUBLIC":
      return true;

    case "PRIVATE":
      return document.user._id.toString() === userId;

    case "SHARE_ORGANIZATION":
      if (!user.organization || !document.user.organization) return false;
      return (
        user.organization._id.toString() ===
        document.user.organization._id.toString()
      );

    case "PRIVATE_SHARED":
      // Check trong shared_documents của user
      const isShared = user.shared_documents?.some(
        (shared) => shared.document.toString() === documentId
      );
      return isShared || document.user._id.toString() === userId;

    default:
      return false;
  }
};
const getFileExtension = (fileType) => {
  const extensions = {
    PDF: "pdf",
    WORD: "docx",
    EXCEL: "xlsx",
    POWERPOINT: "pptx",
    VIDEO: "mp4",
  };
  return extensions[fileType] || "file";
};

// function tinh diem download
const getDownloadPrice = async (documentId, user) => {
  const document = await Document.findById(documentId);
  if (!document) return 0;

  let basePrice = 4;

  if (document.intensive) {
    basePrice += 2;
  }

  // VIP user có giảm giá
  const account = await Account.findOne({ user: user._id });
  if (account?.is_vip) {
    basePrice = Math.ceil(basePrice - 1);
  }

  return basePrice;
};
