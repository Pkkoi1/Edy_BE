const Document = require("../models/document.model");
const User = require("../models/user.model");
const Account = require("../models/account.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
const DownloadLink = require("../models/download_link.model");
const PrivateShare = require("../models/private_share.model");
const Reaction = require("../models/reaction.model");
const ApprovalRequest = require("../models/approval_request.model");
const Assignment = require("../models/assignment.model");
const { createPointTransaction } = require("./point_transaction.service");
const { processDocumentAndCreateEmbedding, processDocumentAndCreateSummary } = require("../utils/tranformers");
const {
  searchDocuments,
  findSimilarDocuments,
  indexDocument,
  updateDocument: updateESDocument,
  deleteDocument: deleteESDocument,
} = require("./elasticsearch.service");
const { updateUserDocCount } = require("./user.service");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const getAllDocuments = async ({
  payload,
  search,
  ordering = "createdAt",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  if(!await hasDocumentManageRole(payload.accountId)){
    throw new Error('User does not have permission to manage documents');
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
    if (mongoose.Types.ObjectId.isValid(search)) {
      searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
    }
  }
  let query = {};

  // Thêm điều kiện search nếu có
  if (searchOr.length > 0) {
    query.$and = [{ $or: searchOr }];
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
    "status",
    "summary_status",
    "public_mode",
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
        "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status summary_status public_mode createdAt last_approved_at updatedAt like dislike"
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

const getNewestDocuments = async ({
  payload,
  search,
  ordering = "last_approved_at",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  // neu co search elastic
  if (search && search.trim()) {
    if (payload && payload.userId) {
      const user = await User.findById(payload.userId);
      const normalizedSearch = search.trim().toUpperCase();

      // Check if the search term already exists in search_history
      const existingIndex = user.search_history.findIndex(
        (item) => item.keyword.toUpperCase() === normalizedSearch
      );

      if (existingIndex !== -1) {
        // Remove the existing search term
        user.search_history.splice(existingIndex, 1);
      }

      // Add the new search term to the beginning of the history
      user.search_history.unshift({
        keyword: search.trim(),
        searched_at: new Date(),
      });

      // Ensure search_history does not exceed 10 entries
      if (user.search_history.length > 10) {
        user.search_history.pop();
      }

      // Save the updated user document
      await user.save();
    }

    return await searchWithElasticsearch({
      payload,
      search: search.trim(),
      ordering,
      order,
      page,
      limit,
      ...filters,
    });
  }

  // dung mongo neu khong elastic ko hd
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
        "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at"
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

const searchWithElasticsearch = async ({
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
      sharedDocIds = user.shared_documents.map((item) =>
        item.document.toString()
      );
    }
  }

  //  Build access filter cho es
  let accessFilter;
  if (user && user.organization) {
    accessFilter = {
      bool: {
        should: [
          { term: { public_mode: "PUBLIC" } },
          {
            bool: {
              must: [
                { term: { public_mode: "SHARE_ORGANIZATION" } },
                { term: { organization: user.organization.toString() } },
              ],
            },
          },
          { term: { user: user._id.toString() } },
        ],
      },
    };

    if (sharedDocIds.length > 0) {
      accessFilter.bool.should.push({
        terms: { id: sharedDocIds },
      });
    }
  } else {
    accessFilter = { term: { public_mode: "PUBLIC" } };
  }

  // Thêm filters vào accessFilter
  const additionalFilters = [];
  Object.keys(filters).forEach((field) => {
    if (filters[field] !== undefined) {
      if (Array.isArray(filters[field])) {
        additionalFilters.push({
          terms: { [field]: filters[field].map((f) => f.toString()) },
        });
      } else {
        additionalFilters.push({
          term: { [field]: filters[field].toString() },
        });
      }
    }
  });

  if (additionalFilters.length > 0) {
    accessFilter = {
      bool: {
        must: [accessFilter, ...additionalFilters],
      },
    };
  }

  const result = await searchDocuments(search, accessFilter, {
    page,
    limit,
    ordering,
    order,
  });

  const totalPages = Math.ceil(result.total / limit);
  const have_next = page < totalPages;

  return {
    documents: result.documents,
    total: result.total,
    page,
    totalPages,
    have_next,
    highlights: result.highlights,
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
  };

  // Thêm điều kiện search nếu có
  if (searchOr.length > 0) {
    query.$and = [{ user: user._id }, { $or: searchOr }];
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

  // Xử lý filter theo ngày createdAt (yyyy-mm-dd)
  if (filters.createdAt) {
    const dateStr = filters.createdAt;
    // Kiểm tra format yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const startDate = new Date(dateStr + "T00:00:00.000Z");
      const endDate = new Date(dateStr + "T23:59:59.999Z");

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        query.createdAt = {
          $gte: startDate,
          $lte: endDate,
        };
      }
    }
  }

  // Sắp xếp
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count status summary_status public_mode like dislike createdAt"
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

  if (documents.length > 0) {
    // Query rejection cho documents bị rejected
    const rejectedDocIds = documents
      .filter(
        (doc) => doc.status === "REJECTED" || doc.summary_status === "REJECTED"
      )
      .map((doc) => doc._id);

    let rejections = [];
    if (rejectedDocIds.length > 0) {
      rejections = await ApprovalRequest.find({
        doc: { $in: rejectedDocIds },
        status: "REJECTED",
      })
        .populate("reviewed_by", "first_name last_name")
        .select("doc message reviewed_by reviewed_at is_summary")
        .sort({ createdAt: -1 });
    }

    // Map rejection vào documents
    documents.forEach((doc) => {
      // Chỉ set rejection cho documents bị reject
      if (doc.status === "REJECTED") {
        doc._doc.content_rejection =
          rejections.find(
            (r) => r.doc.toString() === doc._id.toString() && !r.is_summary
          ) || null;
      }

      if (doc.summary_status === "REJECTED") {
        doc._doc.summary_rejection =
          rejections.find(
            (r) => r.doc.toString() === doc._id.toString() && r.is_summary
          ) || null;
      }
    });
  }

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
  // Tạo embedding cho document
  const result = await processDocumentAndCreateEmbedding(doc.url, doc.file_type);
  doc.content_vector = result.embedding;

  // const summaryResult = await processDocumentAndCreateSummary(doc.url, doc.file_type);
  // console.log("Text created:", summaryResult.text);
  // console.log("Summary created:", summaryResult.summary);
  // Cập nhật số lượng tài liệu của user
  // await updateUserDocCount(data.user);

  try {
    await indexDocument(doc);
    console.log("Document indexed successfully");
  } catch (error) {
    console.error("Lỗi khi đánh index document:", error);
    // Không throw error để không ảnh hưởng đến việc tạo document
  }

  return doc;
};

const deleteDocument = async (id) => {
  const doc = await Document.findByIdAndUpdate(
    id,
    {
      is_deleted: true,
      expiredAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
    { new: true }
  );

  // Cập nhật số lượng tài liệu của user
  if (doc && doc.user) {
    await updateUserDocCount(doc.user);
  }
  try {
    await deleteESDocument(id);
  } catch (error) {
    console.error("Lỗi khi xóa document trong Elasticsearch:", error);
  }

  return doc;
};

const updateDocument = async (id, data) => {
  // Không cho sửa trường is_deleted qua update này
  if ("is_deleted" in data) delete data.is_deleted;
  const doc = await Document.findByIdAndUpdate(id, data, { new: true });
  try {
    await updateESDocument(id, data);
  } catch (error) {
    console.error("Lỗi khi cập nhật document trong Elasticsearch:", error);
  }
  return doc;
};

const getDocumentById = async (id, userId) => {
  const doc = await Document.findOne({ _id: id })
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
  const isDeleted = doc && doc.is_deleted;
  const isOwner = doc && doc.user._id.toString() === userId;
  if (!canView && !isAdmin) {
    throw new Error("Bạn không có quyền truy cập tài liệu này");
  }

  if (canView) {
    // tài liệu bị xóa thì chỉ chủ và admin có thể xem
    if (isDeleted) {
      if (!isOwner && !isAdmin) {
        throw new Error("Bạn không có quyền truy cập tài liệu này");
      }
    }

    if (!isAdmin) {
      if (doc && doc.summary_status !== "APPROVED") {
        if (
          doc.description &&
          (doc.summary_status == "REJECTED" || doc.summary_status == "NONE")
        ) {
          doc.description.summary_by_user =
            "Tài liệu không được tóm tắt bởi người đăng.";
        }
        if (!isOwner &&
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
        "_id user title author published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status summary_status createdAt"
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
    await createPointTransaction(
      user._id,
      "SPEND",
      downloadLink.cost,
      `Tải tài liệu ${document.title}`
    );
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

const changeAllShareLink = async (userId, documentId, newStatus) => {
  const doc = await Document.findOne({
    _id: documentId,
    user: userId,
    is_deleted: false,
  });
  if (!doc) {
    throw new Error("Tài liệu không tồn tại hoặc bạn không có quyền thay đổi");
  }

  const allLinks = await PrivateShare.updateMany(
    { doc: documentId, status: "ACTIVE" },
    { status: newStatus }
  );
};

const getSimilarDocuments = async (documentId, userId, limit = 5) => {
  try {
    // Lấy thông tin document gốc
    const sourceDoc = await Document.findById(documentId)
      .select(
        "title author keyword description subject organization user public_mode"
      )
      .populate("subject", "name");

    if (!sourceDoc) {
      throw new Error("Tài liệu không tồn tại");
    }

    // Kiểm tra quyền truy cập
    const canView = await canViewDocument(userId, documentId);
    const isAdmin = await Account.findOne({ user: userId, is_admin: true });
    if (!canView && !isAdmin) {
      throw new Error("Bạn không có quyền truy cập tài liệu này");
    }

    // Build access filter cho Elasticsearch
    let user = null;
    let sharedDocIds = [];
    if (userId) {
      user = await User.findById(userId).select(
        "organization shared_documents"
      );
      if (user && user.shared_documents && user.shared_documents.length > 0) {
        sharedDocIds = user.shared_documents.map((item) =>
          item.document.toString()
        );
      }
    }

    let accessFilter;
    if (user && user.organization) {
      accessFilter = {
        bool: {
          should: [
            { term: { public_mode: "PUBLIC" } },
            {
              bool: {
                must: [
                  { term: { public_mode: "SHARE_ORGANIZATION" } },
                  { term: { organization: user.organization.toString() } },
                ],
              },
            },
            { term: { user: user._id.toString() } },
          ],
        },
      };

      if (sharedDocIds.length > 0) {
        accessFilter.bool.should.push({
          terms: { id: sharedDocIds },
        });
      }
    } else {
      accessFilter = { term: { public_mode: "PUBLIC" } };
    }

    // Xài es lấy tài liệu tương tự
    const { documentIds, scores } = await findSimilarDocuments(
      sourceDoc,
      userId,
      limit
    );

    if (documentIds.length === 0) {
      return {
        documents: [],
        total: 0,
        similarity_factors: [],
      };
    }

    // Populate thông tin chi tiết từ MongoDB
    const documents = await Document.find({
      _id: { $in: documentIds },
    }).populate([
      {
        path: "user",
        select: "_id first_name last_name avatar doc_count",
        populate: {
          path: "organization",
          select: "_id name",
        },
      },
      { path: "organization", select: "_id name" },
      { path: "subject", select: "_id name" },
    ]);

    // Sắp xếp theo score từ é
    const sortedDocuments = documentIds
      .map((id) => documents.find((doc) => doc._id.toString() === id))
      .filter(Boolean);

    // Tạo similarity factors
    const similarity_factors = sortedDocuments.map((doc) => {
      const factors = [];

      if (
        doc.subject &&
        sourceDoc.subject &&
        doc.subject._id.toString() === sourceDoc.subject._id.toString()
      ) {
        factors.push("same_subject");
      }

      if (sourceDoc.author && doc.author) {
        const commonAuthors = doc.author.filter((author) =>
          sourceDoc.author.includes(author)
        );
        if (commonAuthors.length > 0) {
          factors.push("same_author");
        }
      }

      if (sourceDoc.keyword && doc.keyword) {
        const commonKeywords = doc.keyword.filter((keyword) =>
          sourceDoc.keyword.includes(keyword)
        );
        if (commonKeywords.length > 0) {
          factors.push("same_keywords");
        }
      }

      return {
        document_id: doc._id,
        factors,
        elasticsearch_score: scores[doc._id.toString()] || 0,
      };
    });

    return {
      documents: sortedDocuments,
      total: sortedDocuments.length,
      similarity_factors,
      source_document: {
        id: sourceDoc._id,
        title: sourceDoc.title,
        subject: sourceDoc.subject?.name,
        author: sourceDoc.author,
        keywords: sourceDoc.keyword,
      },
    };
  } catch (error) {
    throw new Error(`Lỗi lấy tài liệu tương tự: ${error.message}`);
  }
};

const reactionDocument = async (documentId, userId, reactionType) => {
  const doc = await Document.findById(documentId);
  if (!doc) {
    throw new Error("Tài liệu không tồn tại");
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }

  const existingReaction = await Reaction.findOne({
    doc: documentId,
    user: userId,
  });

  if (reactionType === "UNREACT") {
    if (existingReaction) {
      if (existingReaction.type === "LIKE") {
        doc.like -= 1;
      } else {
        doc.dislike -= 1;
      }
      await doc.save();
      await existingReaction.deleteOne();
    }
    return { documentId, userId, reactionType };
  }

  if (!["LIKE", "DISLIKE"].includes(reactionType)) {
    throw new Error("Loại reaction không hợp lệ");
  }

  if (existingReaction) {
    // Nếu đã phản ứng, cập nhật loại phản ứng
    if (existingReaction.type === "LIKE" && reactionType === "DISLIKE") {
      doc.like -= 1;
      doc.dislike += 1;
    } else if (existingReaction.type === "DISLIKE" && reactionType === "LIKE") {
      doc.like += 1;
      doc.dislike -= 1;
    }
    existingReaction.type = reactionType;
    await existingReaction.save();
  } else {
    // Nếu chưa phản ứng, tạo mới
    const newReaction = new Reaction({
      doc: documentId,
      user: userId,
      type: reactionType,
    });
    if (newReaction.type === "LIKE") {
      doc.like += 1;
    } else {
      doc.dislike += 1;
    }
    await newReaction.save();
  }
  await doc.save();

  return {
    documentId,
    userId,
    reactionType,
  };
};

const getDocumentReactions = async (documentId, userId) => {
  const doc = await Document.findById(documentId);
  if (!doc) {
    throw new Error("Tài liệu không tồn tại");
  }
  const reactions = await Reaction.find({ doc: documentId });
  const likes = reactions.filter((r) => r.type === "LIKE").length;
  const dislikes = reactions.filter((r) => r.type === "DISLIKE").length;
  const total = reactions.length;
  // rating la tỷ lệ likes trên tổng số reaction, nếu ko có reaction thì rating = 0, lam tron so int
  const rating = likes + dislikes === 0 ? 0 : likes / total;
  // neu nguoi dung da like thi la LIKE, da dislike thi la DISLIKE, chua react thi la NONE
  const reacted =
    reactions.find((r) => r.user.toString() === userId.toString())?.type ||
    "NONE";
  const reactionResult = {
    docId: documentId,
    likes,
    dislikes,
    total,
    rating: Math.round(rating * 100),
    reacted,
  };
  return reactionResult;
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
  }).populate("user organization");

  if (!document) return false;

  const user = await User.findById(userId).populate("organization");
  if (!user) {
    if (document.public_mode === "PUBLIC") return true;
    else return false;
  }
  // chủ sở hữu luôn được xem
  if (document.user._id.toString() === userId) return true;

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
        document.organization._id.toString()
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

const addToHistory = async (userId, documentId) => {
  // Lấy thông tin người dùng hiện tại
  const user = await User.findById(userId);

  if (!user) return;

  const doc = await Document.findById(documentId);

  if (!doc) return;

  //Nếu là chủ tài liệu thì khỏi lưu vào lịch sử
  if (doc.user._id.toString() === userId) return;

  // Tạo mảng lịch sử mới
  let newHistory = user.read_history || [];

  // Xóa tài liệu khỏi lịch sử nếu đã tồn tại
  newHistory = newHistory.filter((item) => !item.document?.equals(documentId));

  // Thêm tài liệu mới vào đầu mảng
  newHistory.unshift({
    document: documentId,
    read_at: new Date(),
  });

  // Giữ chỉ 10 tài liệu gần nhất
  if (newHistory.length > 10) {
    newHistory = newHistory.slice(0, 10);
  }

  // Cập nhật lịch sử đọc của người dùng
  await User.findByIdAndUpdate(userId, { read_history: newHistory });
};

const getReadHistory = async (userId) => {
  const user = await User.findById(userId);
  const read_history = user.read_history || [];
  const detailedHistory = await Promise.all(
    read_history.map(async (item) => ({
      document: await getDocumentById(item.document),
      read_at: item.read_at,
    }))
  );
  return detailedHistory;
};

const getDocumentsByUserId = async ({
  userId,
  payload,
  search,
  ordering = "createdAt",
  order = -1,
  page = 1,
  limit = 5,
  ...filters
}) => {
  // Kiểm tra user tồn tại
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new Error("Người dùng không tồn tại");
  }

  let currentUser = null;
  let sharedDocIds = [];
  if (payload && payload.userId) {
    currentUser = await User.findById(payload.userId).populate("organization");
    if (currentUser) {
      const privateShares = await PrivateShare.find({
        invited_users: currentUser._id,
        status: "ACTIVE",
        expiredAt: { $gt: new Date() },
      }).select("document");
      sharedDocIds = privateShares.map((share) => share.document);
    }
  }

  const skip = (page - 1) * limit;

  // Điều kiện quyền truy cập
  let accessOr = [];
  if (currentUser && currentUser.organization) {
    accessOr = [
      { public_mode: "PUBLIC" },
      {
        public_mode: "SHARE_ORGANIZATION",
        organization: currentUser.organization._id,
      },
      { _id: { $in: sharedDocIds } },
      { user: currentUser._id }, // Người dùng hiện tại có thể xem tài liệu của mình
    ];
  } else {
    accessOr = [{ public_mode: "PUBLIC" }];
  }

  // Điều kiện tìm kiếm
  let searchOr = [];
  if (search) {
    searchOr = [
      { title: { $regex: search, $options: "i" } },
      { author: { $regex: search, $options: "i" } },
      { keyword: { $regex: search, $options: "i" } },
    ];
  }

  // Kết hợp điều kiện
  let query = {
    user: userId,
    status: "APPROVED",
    is_deleted: false,
  };

  if (searchOr.length > 0) {
    query.$and = [{ $or: accessOr }, { $or: searchOr }];
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
    "keyword",
    "doc_type",
    "level",
    "subject",
  ];

  filterFields.forEach((field) => {
    if (filters[field] !== undefined && filters[field] !== "") {
      if (field === "intensive") {
        query[field] = filters[field] === "true";
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
        "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status createdAt last_approved_at"
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

module.exports = {
  getAllDocuments,
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
  changeAllShareLink,
  getSimilarDocuments,
  reactionDocument,
  getDocumentReactions,
  canViewDocument,
  addToHistory,
  getReadHistory,
  getDocumentsByUserId,
};

const hasDocumentManageRole = async (accountId, documentId) => {
    const assignments = await Assignment.find({ account: accountId, is_active: true }).populate("role");
    const userRoles = assignments.filter(assignment => assignment.role.permissions.includes('MANAGE_DOCUMENT') || assignment.role.permissions.includes('ALL'));
    return userRoles.some(role => role.role.permissions.includes('MANAGE_DOCUMENT') || role.role.permissions.includes('ALL'));
}
