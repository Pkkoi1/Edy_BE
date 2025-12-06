const Document = require("../models/document.model");
const User = require("../models/user.model");
const Account = require("../models/account.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
const DownloadLink = require("../models/download_link.model");
const PrivateShare = require("../models/private_share.model");
const Reaction = require("../models/reaction.model");
const ApprovalRequest = require("../models/approval_request.model");
const EditApproval = require("../models/edit_approval.model");
const Assignment = require("../models/assignment.model");
const AccessRequest = require("../models/access_request.model");
const Role = require("../models/role.model");
const PointTransaction = require("../models/point_transaction.model");
const {
  createPointTransaction,
  earnPoints,
} = require("./point_transaction.service");
const {
  processDocumentAndCreateEmbedding,
  processDocumentAndCreateSummary,
} = require("../utils/tranformers");
const {
  searchDocuments,
  findSimilarDocuments,
  findSimilarDocumentsForAdmin,
  indexDocument,
  updateDocument: updateESDocument,
  deleteDocument: deleteESDocument,
} = require("./elasticsearch.service");
const { updateUserDocCount } = require("./user.service");
const {
  incrementDownloadCount,
  updateDocumentStats,
} = require("./user_statistics.service");
const {
  updateViewCount,
  updateDownloadCount,
} = require("./document_statistics.service");
const { logActivity } = require("./activity_log.service");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const e = require("express");

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
  if (!(await hasDocumentManageRole(payload.accountId))) {
    throw new Error("User does not have permission to manage documents");
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
        "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status public_mode createdAt last_approved_at updatedAt like dislike"
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

// Lấy tài liệu nổi bật gần đây trong một khoảng thời gian
// Dựa trên lượt tải xuống và lượt reaction trong khoảng thời gian chỉ định
const getFeaturedDocuments = async ({
  payload,
  from,
  to,
  days = 60,
  page = 1,
  limit = 5,
  ...filters
}) => {
  // Đảm bảo trả về tối thiểu 5 tài liệu
  const MIN_COUNT = 5;
  // Xác định khoảng thời gian
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  // Build quyền truy cập tương tự getNewestDocuments
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

  // Lấy thống kê trong khoảng thời gian: downloads và reactions
  const [downloadsAgg, reactionsAgg] = await Promise.all([
    DownloadLink.aggregate([
      { $match: { status: "SUCCESS", accessedAt: { $gte: start, $lte: end } } },
      { $group: { _id: "$doc", downloads: { $sum: 1 } } },
    ]),
    Reaction.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { doc: "$doc", type: "$type" }, count: { $sum: 1 } } },
    ]),
  ]);

  const likesByDoc = {};
  const dislikesByDoc = {};
  reactionsAgg.forEach((r) => {
    const docId = r._id.doc.toString();
    if (r._id.type === "LIKE")
      likesByDoc[docId] = (likesByDoc[docId] || 0) + r.count;
    if (r._id.type === "DISLIKE")
      dislikesByDoc[docId] = (dislikesByDoc[docId] || 0) + r.count;
  });

  const downloadByDoc = {};
  downloadsAgg.forEach((d) => {
    const docId = d._id.toString();
    downloadByDoc[docId] = d.downloads;
  });

  // Tập doc có tương tác trong khoảng thời gian
  const candidateIds = Array.from(
    new Set([
      ...Object.keys(downloadByDoc),
      ...Object.keys(likesByDoc),
      ...Object.keys(dislikesByDoc),
    ])
  ).map((id) => new mongoose.Types.ObjectId(id));

  // Query filter cơ bản
  const baseQuery = {
    status: "APPROVED",
    is_deleted: false,
    last_approved_at: { $ne: null, $gte: start, $lte: end },
  };

  // Áp dụng các filter bổ sung (nếu có)
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
        baseQuery[field] = { $in: filters[field] };
      } else {
        baseQuery[field] = filters[field];
      }
    }
  });

  const skip = (page - 1) * limit;

  // Nếu không có doc tương tác, fallback: lấy theo thời gian duyệt mới nhất trong khoảng
  if (candidateIds.length === 0) {
    const query = { ...baseQuery, $or: accessOr };
    // Luôn cố gắng trả về tối thiểu MIN_COUNT tài liệu
    const desired = Math.max(limit, MIN_COUNT);
    const [documents, totalRaw] = await Promise.all([
      Document.find(query)
        .sort({ last_approved_at: -1 })
        .skip(skip)
        .limit(desired)
        .select(
          "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at"
        )
        .populate({
          path: "user",
          select: "_id first_name last_name avatar doc_count",
          populate: { path: "organization", select: "_id name" },
        })
        .populate({ path: "organization", select: "_id name" })
        .populate({ path: "subject", select: "_id name" }),
      Document.countDocuments(query),
    ]);
    const total = Math.min(totalRaw, 50);
    // Nếu vẫn chưa đủ, bổ sung thêm từ tất cả thời gian (bỏ qua giới hạn khoảng thời gian)
    let filledDocs = documents;
    if (filledDocs.length < desired) {
      const excludeIds = new Set(filledDocs.map((d) => d._id.toString()));
      const allTimeQuery = {
        status: "APPROVED",
        is_deleted: false,
        $or: accessOr,
        _id: {
          $nin: Array.from(excludeIds).map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      };
      const moreAllTime = await Document.find(allTimeQuery)
        .sort({ last_approved_at: -1 })
        .limit(desired - filledDocs.length)
        .select(
          "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at"
        )
        .populate({
          path: "user",
          select: "_id first_name last_name avatar doc_count",
          populate: { path: "organization", select: "_id name" },
        })
        .populate({ path: "organization", select: "_id name" })
        .populate({ path: "subject", select: "_id name" });
      filledDocs = [...filledDocs, ...moreAllTime];
    }
    // Nếu vẫn chưa đủ, bổ sung thêm bằng newest (APPROVED mới duyệt)
    if (filledDocs.length < desired) {
      const excludeSet = new Set(filledDocs.map((d) => d._id.toString()));
      const newestRes = await getNewestDocuments({
        payload,
        page: 1,
        limit: desired - filledDocs.length,
        ordering: "last_approved_at",
        order: -1,
        ...filters,
      });
      const extraNewest = (newestRes.documents || []).filter(
        (d) => !excludeSet.has(d._id.toString())
      );
      filledDocs = [...filledDocs, ...extraNewest];
    }
    return {
      documents: filledDocs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      have_next: page < Math.ceil(total / limit),
      period: { from: start, to: end },
    };
  }

  // Lấy đầy đủ thông tin các candidate, có áp dụng quyền truy cập
  const query = { ...baseQuery, $or: accessOr, _id: { $in: candidateIds } };
  const candidates = await Document.find(query)
    .select(
      "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at like dislike"
    )
    .populate({
      path: "user",
      select: "_id first_name last_name avatar doc_count",
      populate: { path: "organization", select: "_id name" },
    })
    .populate({ path: "organization", select: "_id name" })
    .populate({ path: "subject", select: "_id name" });

  // Tính điểm nổi bật: downloads*3 + likes*2 - dislikes + bonus theo độ mới
  const now = end.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const scored = candidates.map((doc) => {
    const id = doc._id.toString();
    const dl = downloadByDoc[id] || 0;
    const lk = likesByDoc[id] || 0;
    const dk = dislikesByDoc[id] || 0;
    const daysSince = doc.last_approved_at
      ? Math.max(0, (now - new Date(doc.last_approved_at).getTime()) / msPerDay)
      : days;
    const recencyBoost = 1 / (1 + daysSince); // càng mới càng cao
    const score = dl * 3 + lk * 2 - dk + recencyBoost;
    return { score, doc };
  });

  scored.sort((a, b) => b.score - a.score);

  const total = Math.min(scored.length, 50);
  const totalPages = Math.ceil(total / limit);
  let slice = scored
    .slice(0, 50)
    .slice(skip, skip + limit)
    .map((s) => s.doc);

  // Bổ sung fallback để đảm bảo ít nhất MIN_COUNT tài liệu
  const desired = Math.max(limit, MIN_COUNT);
  if (slice.length < desired) {
    const excludeIds = new Set(slice.map((d) => d._id.toString()));
    const excludedAll = new Set([
      ...excludeIds,
      ...candidateIds.map((id) => id.toString()),
    ]);

    // Ưu tiên bổ sung trong cùng khoảng thời gian nhưng không thuộc candidate
    const timeframeFallbackQuery = {
      ...baseQuery,
      $or: accessOr,
      _id: {
        $nin: Array.from(excludedAll).map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      },
    };
    const extraInTimeframe = await Document.find(timeframeFallbackQuery)
      .sort({ last_approved_at: -1 })
      .limit(desired - slice.length)
      .select(
        "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at"
      )
      .populate({
        path: "user",
        select: "_id first_name last_name avatar doc_count",
        populate: { path: "organization", select: "_id name" },
      })
      .populate({ path: "organization", select: "_id name" })
      .populate({ path: "subject", select: "_id name" });

    slice = [...slice, ...extraInTimeframe];

    // Nếu vẫn chưa đủ, bổ sung thêm từ tất cả thời gian
    if (slice.length < desired) {
      const excludeIds2 = new Set(slice.map((d) => d._id.toString()));
      const allTimeQuery = {
        status: "APPROVED",
        is_deleted: false,
        $or: accessOr,
        _id: {
          $nin: Array.from(excludeIds2).map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        },
      };
      const extraAllTime = await Document.find(allTimeQuery)
        .sort({ last_approved_at: -1 })
        .limit(desired - slice.length)
        .select(
          "_id user title author cover_page published_year publisher page doc_type file_type intensive url organization subject level view download_count status comment_count createdAt last_approved_at"
        )
        .populate({
          path: "user",
          select: "_id first_name last_name avatar doc_count",
          populate: { path: "organization", select: "_id name" },
        })
        .populate({ path: "organization", select: "_id name" })
        .populate({ path: "subject", select: "_id name" });
      slice = [...slice, ...extraAllTime];
    }
    // Nếu vẫn chưa đủ, bổ sung thêm bằng newest (APPROVED mới duyệt)
    if (slice.length < desired) {
      const excludeSet = new Set(slice.map((d) => d._id.toString()));
      const newestRes = await getNewestDocuments({
        payload,
        page: 1,
        limit: desired - slice.length,
        ordering: "last_approved_at",
        order: -1,
        ...filters,
      });
      const extraNewest = (newestRes.documents || []).filter(
        (d) => !excludeSet.has(d._id.toString())
      );
      slice = [...slice, ...extraNewest];
    }
  }

  return {
    documents: slice,
    total,
    page,
    totalPages,
    have_next: page < totalPages,
    period: { from: start, to: end },
  };
};

// Gợi ý tài liệu có thể bạn quan tâm dựa theo thông tin user
const getRecommendedDocuments = async ({ payload, page = 1, limit = 10 }) => {
  if (!payload || !payload.userId) {
    // Khách: fallback dùng newest
    return await getNewestDocuments({
      payload,
      page,
      limit,
      ordering: "last_approved_at",
      order: -1,
    });
  }

  const userId = payload.userId;
  const user = await User.findById(userId).select(
    "organization shared_documents search_history read_history favorites field_of_study"
  );

  // Access filter cho ES
  let sharedDocIds = [];
  if (user && user.shared_documents && user.shared_documents.length > 0) {
    sharedDocIds = user.shared_documents.map((item) =>
      item.document.toString()
    );
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
      accessFilter.bool.should.push({ terms: { id: sharedDocIds } });
    }
  } else {
    accessFilter = { term: { public_mode: "PUBLIC" } };
  }

  // Gom seed: từ khoá tìm kiếm, field_of_study, tác giả/keyword/subject từ favorites & read_history
  const keywordSeeds = (user.search_history || [])
    .sort((a, b) => new Date(b.searched_at) - new Date(a.searched_at))
    .slice(0, 10)
    .map((x) => x.keyword)
    .filter(Boolean);

  const studyFields = (user.field_of_study || []).slice(0, 5);

  const favoriteDocIds = (user.favorites || [])
    .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
    .slice(0, 5)
    .map((x) => x.document.toString());

  const readDocIds = (user.read_history || [])
    .sort((a, b) => new Date(b.read_at) - new Date(a.read_at))
    .slice(0, 10)
    .map((x) => x.document.toString());

  const excludeIds = new Set([...favoriteDocIds, ...readDocIds]);

  const seedIds = [...favoriteDocIds, ...readDocIds];
  let authorSeeds = [];
  let keywordDocSeeds = [];
  let subjectSeeds = [];
  if (seedIds.length > 0) {
    const seedDocs = await Document.find({
      _id: { $in: seedIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("author keyword subject")
      .populate({ path: "subject", select: "name" });
    for (const d of seedDocs) {
      if (Array.isArray(d.author)) authorSeeds.push(...d.author);
      if (Array.isArray(d.keyword)) keywordDocSeeds.push(...d.keyword);
      if (d.subject && d.subject.name) subjectSeeds.push(d.subject.name);
    }
  }

  // Hợp nhất và giới hạn số token
  const tokensSet = new Set(
    [
      ...keywordSeeds,
      ...studyFields,
      ...authorSeeds,
      ...keywordDocSeeds,
      ...subjectSeeds,
    ].filter((t) => !!t && String(t).trim().length >= 2)
  );

  const tokens = Array.from(tokensSet).slice(0, 20);
  if (tokens.length === 0) {
    return await getNewestDocuments({
      payload,
      page,
      limit,
      ordering: "last_approved_at",
      order: -1,
    });
  }

  const combinedQuery = tokens.join(" ");

  // Gọi ES một lần với query tổng hợp
  let esResult;
  try {
    esResult = await searchDocuments(combinedQuery, accessFilter, {
      page: 1,
      limit: Math.max(limit * 5, 30),
      ordering: "last_approved_at",
      order: -1,
    });
  } catch (e) {
    // lỗi ES -> fallback newest
    return await getNewestDocuments({
      payload,
      page,
      limit,
      ordering: "last_approved_at",
      order: -1,
    });
  }

  const { documents, highlights } = esResult || {
    documents: [],
    highlights: {},
  };
  if (!documents || documents.length === 0) {
    return await getNewestDocuments({
      payload,
      page,
      limit,
      ordering: "last_approved_at",
      order: -1,
    });
  }

  // Chấm điểm theo highlight + độ mới, loại trừ đã yêu thích/đã đọc
  const msPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const scored = documents
    .filter((doc) => !excludeIds.has(doc._id.toString()))
    .map((doc) => {
      const id = doc._id.toString();
      const hl = highlights?.[id] || {};
      const matchScore =
        (Array.isArray(hl.title) ? hl.title.length : 0) * 2 +
        (Array.isArray(hl.author) ? hl.author.length : 0) * 1.5 +
        (Array.isArray(hl.keyword) ? hl.keyword.length : 0) * 1.5;
      const daysSince = doc.last_approved_at
        ? Math.max(
            0,
            (now - new Date(doc.last_approved_at).getTime()) / msPerDay
          )
        : 365;
      const recencyBoost = 0.5 / (1 + daysSince);
      return { score: matchScore + recencyBoost, doc };
    });

  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const slice = scored.slice(skip, skip + limit).map((s) => s.doc);

  return {
    documents: slice,
    total,
    page,
    totalPages,
    have_next: page < totalPages,
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
  is_admin = false,
  ...filters
}) => {
  const isValidSubject = await validateSubjects(subject);
  if (!isValidSubject) {
    throw new Error("Môn học không hợp lệ");
  }

  let user = null;
  let sharedDocIds = [];
  if (!is_admin && payload && payload.userId) {
    user = await User.findById(payload.userId).select(
      "organization shared_documents"
    );
    if (user && user.shared_documents && user.shared_documents.length > 0) {
      sharedDocIds = user.shared_documents.map((item) => item.document);
    }
  }

  const skip = (page - 1) * limit;

  let query = {
    status: "APPROVED",
    is_deleted: false,
    subject,
  };

  if (!is_admin) {
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
  } else {
    // Admin: chỉ tìm kiếm nếu có
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $elemMatch: { $regex: search, $options: "i" } } },
        { keyword: { $elemMatch: { $regex: search, $options: "i" } } },
      ];
    }
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
        "_id user title author published_year publisher page file_type doc_type intensive url organization subject level view download_count comment_count status public_mode like dislike createdAt is_deleted is_delete_by_admin delete_by_admin_reason delete_by_admin_at expiredAt"
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
      .filter((doc) => doc.status === "REJECTED")
      .map((doc) => doc._id);

    let rejections = [];
    if (rejectedDocIds.length > 0) {
      rejections = await ApprovalRequest.find({
        doc: { $in: rejectedDocIds },
        status: "REJECTED",
      })
        .populate("reviewed_by", "first_name last_name")
        .select("doc message reviewed_by reviewed_at")
        .sort({ createdAt: -1 });
    }

    // Map rejection vào documents
    documents.forEach((doc) => {
      // Chỉ set rejection cho documents bị reject
      if (doc.status === "REJECTED") {
        doc._doc.rejection =
          rejections.find((r) => r.doc.toString() === doc._id.toString()) ||
          null;
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

// Hàm kiểm tra xem file có thể tạo embedding không (dựa trên file_type và đuôi URL)
const canCreateEmbedding = (fileType, url) => {
  // Kiểm tra file_type trước
  if (fileType !== "WORD" && fileType !== "PDF") {
    return false;
  }

  // Kiểm tra đuôi file từ URL
  if (!url) return false;

  const urlLower = url.toLowerCase();
  const supportedExtensions = [".pdf", ".doc", ".docx"];

  return supportedExtensions.some((ext) => urlLower.endsWith(ext));
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

  await updateUserDocCount(data.user);

  return doc;
};

const embeddinngDocument = async (document) => {
  try {
    const result = await processDocumentAndCreateEmbedding(
      document.url,
      document.file_type
    );
    document.content_vector = result.embedding;
    try {
      await indexDocument(document);
    } catch (error) {
      console.error("Lỗi khi đánh index document:", error);
    }
    return document;
  } catch (error) {
    console.error("Lỗi khi tạo embedding cho document:", error);
    throw new Error("Không thể tạo embedding cho tài liệu");
  }
};

const deleteDocument = async (documentId, userId, reason) => {
  const doc = await Document.findById(documentId);
  if (!doc) {
    throw new Error("Tài liệu không tồn tại");
  }
  const isOwner = doc.user._id.toString() === userId;
  const isAdmin = await Account.findOne({ user: userId, is_admin: true });
  // Kiểm tra quyền: owner hoặc admin
  if (!isOwner && !isAdmin) {
    throw new Error("Bạn không có quyền xóa tài liệu này");
  }

  if (!isOwner) {
    if (isAdmin) {
      doc.is_delete_by_admin = true;
      doc.delete_by_admin = userId;
      doc.delete_by_admin_reason = reason;
      doc.delete_by_admin_at = new Date();
    }
  }

  doc.is_deleted = true;
  doc.expiredAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  await doc.save();

  // Cập nhật số lượng tài liệu của user
  if (doc && doc.user) {
    await updateUserDocCount(doc.user);
  }
  try {
    await deleteESDocument(documentId);
  } catch (error) {
    console.error("Lỗi khi xóa document trong Elasticsearch:", error);
  }

  // xoas lioch su neu can thiet
  await User.updateMany(
    { "read_history.document": documentId },
    { $pull: { read_history: { document: documentId } } }
  );

  // xóa hết private_share liên quan đến document này
  await PrivateShare.deleteMany({
    doc: documentId,
  });

  // xóa hết access request liên quan đến document này
  await AccessRequest.deleteMany({
    doc: documentId,
  });

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
  let doc = await Document.findOne({ _id: id })
    .populate({
      path: "user",
      select:
        "_id first_name last_name avatar organization follower following doc_count point rank_point strike",
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
    await deleteFromHistoryIfHave(id, userId);
    throw new Error("Bạn không có quyền truy cập tài liệu này");
  }

  if (canView) {
    // tài liệu bị xóa thì chỉ chủ và admin có thể xem
    if (isDeleted) {
      if (!isOwner && !isAdmin) {
        await deleteFromHistoryIfHave(id, userId);
        throw new Error("Bạn không có quyền truy cập tài liệu này");
      }
    }
  }

  // VIP users get access to AI-generated summary; non-VIP users should not see it
  if (userId && doc) {
    const account = await Account.findOne({ user: userId }).select("is_vip");
    if (account?.is_vip) {
      // keep summary as-is (already on doc)
    } else {
      // remove summary for non-VIP users
      if (doc.summary_by_ai) {
        // convert to plain object and null out summary
        const obj = doc.toObject ? doc.toObject() : { ...doc };
        obj.summary_by_ai = null;
        doc = obj;
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
  show_all = false,
  ...filters
}) => {
  const skip = (page - 1) * limit;

  // Kiểm tra quyền admin và filter theo organization + assigned_to
  let hasAllPermission = false;
  let hasManageDocumentPermission = false;
  let allowedOrgIds = [];
  let canReviewAllOrg = false;

  if (payload && payload.accountId) {
    const account = await Account.findById(payload.accountId);
    if (account && account.is_admin) {
      // Lấy tất cả assignment active của admin
      const assignments = await Assignment.find({
        account: payload.accountId,
        is_active: true,
      }).populate({
        path: "role",
        select: "_id code permissions",
      });

      // Kiểm tra xem admin có quyền ALL không
      hasAllPermission = assignments.some(
        (assignment) =>
          assignment.role && assignment.role.permissions.includes("ALL")
      );

      if (!hasAllPermission) {
        // Kiểm tra admin có quyền MANAGE_DOCUMENT không
        const documentAssignments = assignments.filter(
          (assignment) =>
            assignment.role &&
            assignment.role.permissions.includes("MANAGE_DOCUMENT")
        );

        if (documentAssignments.length > 0) {
          hasManageDocumentPermission = true;

          // Lấy danh sách organization IDs mà admin có thể duyệt
          for (const assignment of documentAssignments) {
            const assignmentOrgId = assignment.organization;

            // Nếu assignment không có organization cụ thể, admin có thể duyệt tất cả
            if (!assignmentOrgId) {
              canReviewAllOrg = true;
              break;
            } else {
              allowedOrgIds.push(assignmentOrgId);
            }
          }
        }
      }
    }
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

  // Query cơ bản cho pending documents
  let query = {
    $or: [{ status: "PENDING" }, { status: "PENDING_EDIT" }],
    is_deleted: false,
  };

  // Kiểm tra quyền và filter theo organization + assigned_to
  let currentAdminUserId = null;
  if (payload && payload.accountId) {
    const account = await Account.findById(payload.accountId);
    if (account && account.is_admin) {
      currentAdminUserId = account.user;

      // Nếu show_all = true và admin có quyền (ALL hoặc MANAGE_DOCUMENT), xem tất cả không filter
      if (show_all) {
        // Chỉ cho phép xem tất cả nếu admin có quyền ALL hoặc MANAGE_DOCUMENT
        if (hasAllPermission || hasManageDocumentPermission) {
          // Không thêm filter nào, admin sẽ thấy tất cả pending documents
          // Bỏ qua phần filter bên dưới
        } else {
          // Admin không có quyền, không thấy document nào
          return {
            documents: [],
            total: 0,
            page,
            totalPages: 0,
            have_next: false,
          };
        }
      } else if (!hasAllPermission) {
        // Nếu không có option show_all, áp dụng filter theo quyền như bình thường
        // Lấy danh sách documents có approval request với assigned_to = null
        const documentsWithNullAssignment = await ApprovalRequest.aggregate([
          {
            $match: {
              status: "PENDING",
              assigned_to: null,
            },
          },
          {
            $lookup: {
              from: "documents",
              localField: "doc",
              foreignField: "_id",
              as: "document",
            },
          },
          {
            $unwind: "$document",
          },
          {
            $match: {
              "document.status": { $in: ["PENDING", "PENDING_EDIT"] },
              "document.is_deleted": false,
            },
          },
          {
            $project: {
              docId: "$doc",
            },
          },
        ]);

        const docIdsWithNullAssignment = documentsWithNullAssignment.map(
          (item) => item.docId
        );

        // Nếu admin có quyền MANAGE_DOCUMENT
        if (hasManageDocumentPermission) {
          // Tạo điều kiện OR:
          // 1. Documents có assigned_to = null (tất cả admin MANAGE_DOCUMENT thấy được)
          // 2. Documents được gán cho admin hiện tại
          // 3. Documents thuộc organization mà admin được gán
          const orConditions = [];

          // Điều kiện 1: Documents có assigned_to = null
          if (docIdsWithNullAssignment.length > 0) {
            orConditions.push({ _id: { $in: docIdsWithNullAssignment } });
          }

          // Điều kiện 2: Documents được gán cho admin hiện tại
          const documentsAssignedToMe = await ApprovalRequest.find({
            status: "PENDING",
            assigned_to: currentAdminUserId,
          }).select("doc");
          const docIdsAssignedToMe = documentsAssignedToMe.map(
            (req) => req.doc
          );
          if (docIdsAssignedToMe.length > 0) {
            orConditions.push({ _id: { $in: docIdsAssignedToMe } });
          }

          // Điều kiện 3: Documents thuộc organization mà admin được gán
          if (canReviewAllOrg) {
            // Admin có thể duyệt tất cả document có organization
            orConditions.push({ organization: { $ne: null } });
          } else if (allowedOrgIds.length > 0) {
            // Admin chỉ có thể duyệt document của các organization được gán
            orConditions.push({ organization: { $in: allowedOrgIds } });
          }

          // Nếu không có điều kiện nào, admin không thấy document nào
          if (orConditions.length === 0) {
            return {
              documents: [],
              total: 0,
              page,
              totalPages: 0,
              have_next: false,
            };
          }

          // Thêm điều kiện OR vào query
          query.$and = query.$and || [];
          query.$and.push({ $or: orConditions });
        } else {
          // Admin không có quyền MANAGE_DOCUMENT, không thấy document nào
          return {
            documents: [],
            total: 0,
            page,
            totalPages: 0,
            have_next: false,
          };
        }
      }
      // Nếu admin có quyền ALL, không cần thêm filter
    } else {
      // Không phải admin, không thấy pending documents
      return {
        documents: [],
        total: 0,
        page,
        totalPages: 0,
        have_next: false,
      };
    }
  } else {
    // Không có payload hoặc không phải admin, không thấy pending documents
    return {
      documents: [],
      total: 0,
      page,
      totalPages: 0,
      have_next: false,
    };
  }

  // Thêm điều kiện search nếu có
  if (searchOr.length > 0) {
    query.$and = [
      {
        $or: [{ status: "PENDING" }, { status: "PENDING_EDIT" }],
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
        "_id user title author published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status createdAt"
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

const getMyPendingDocuments = async (
  userId,
  { ordering = "createdAt", order = -1, page = 1, limit = 5 } = {}
) => {
  // Thu thập docIds từ ApprovalRequest được gán cho tôi
  const approvals = await ApprovalRequest.find({
    assigned_to: userId,
    status: "PENDING",
  }).select("doc");
  const docIdsFromApprovals = approvals.map((a) => a.doc);

  // Thu thập docIds từ EditApproval được gán cho tôi
  const editApprovals = await EditApproval.find({
    assigned_to: userId,
    status: "PENDING",
  }).select("doc");
  const docIdsFromEditApprovals = editApprovals.map((ea) => ea.doc);

  const docIdSet = new Set([
    ...docIdsFromApprovals.map((id) => id.toString()),
    ...docIdsFromEditApprovals.map((id) => id.toString()),
  ]);
  const docIds = Array.from(docIdSet).map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  // Không có tài liệu được gán -> trả về rỗng cùng format
  if (docIds.length === 0) {
    return {
      documents: [],
      total: 0,
      page,
      totalPages: 0,
      have_next: false,
    };
  }

  const query = {
    _id: { $in: docIds },
    is_deleted: false,
    $or: [{ status: "PENDING" }, { status: "PENDING_EDIT" }],
  };

  const skip = (page - 1) * limit;
  const sort = {};
  sort[ordering] = parseInt(order);

  const [documents, total] = await Promise.all([
    Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(
        "_id user title author published_year publisher page doc_type file_type intensive url organization subject level view download_count comment_count status createdAt"
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

  // Ghép ai_violation_level từ ApprovalRequest (PENDING, assigned_to: userId) cho các doc trong trang hiện tại
  const pageDocIds = documents.map((d) => d._id);
  const approvalsForPageDocs = await ApprovalRequest.find({
    doc: { $in: pageDocIds },
    status: "PENDING",
    assigned_to: userId,
  })
    .select("doc ai_violation_level createdAt")
    .sort({ createdAt: -1 });

  const violationMap = {};
  approvalsForPageDocs.forEach((ap) => {
    const id = ap.doc.toString();
    if (!violationMap[id]) {
      violationMap[id] = ap.ai_violation_level;
    }
  });

  const documentsWithViolation = documents.map((d) => {
    const obj = d.toObject ? d.toObject() : { ...d };
    obj.ai_violation_level = violationMap[d._id.toString()] || "NONE";
    return obj;
  });

  const totalPages = Math.ceil(total / limit);
  const have_next = page < totalPages;

  return {
    documents: documentsWithViolation,
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
      `Tải tài liệu ${document.title}`,
      "USAGE",
      document._id
    );
  }

  // Cập nhật download count status
  document.download_count = (document.download_count || 0) + 1;

  await Promise.all([user.save(), document.save(), downloadLink.save()]);

  // Cập nhật thống kê download
  try {
    await incrementDownloadCount(userId);
    await updateDocumentStats(document, document.user.toString(), "download");
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê download:", statsError);
  }

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

  // Cập nhật thống kê download
  try {
    await updateDownloadCount(downloadLink._id);
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê download:", statsError);
  }

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

const getSimilarDocumentsForAdmin = async (documentId, limit = 5) => {
  try {
    const sourceDoc = await Document.findById(documentId)
      .select(
        "title author keyword description subject organization user public_mode is_deleted"
      )
      .populate("subject", "name");

    if (!sourceDoc) {
      throw new Error("Tài liệu không tồn tại");
    }

    if (sourceDoc.is_deleted) {
      throw new Error("Tài liệu đã bị xóa");
    }

    const { documentIds, scores } = await findSimilarDocumentsForAdmin(
      documentId,
      limit
    );

    if (documentIds.length === 0) {
      return {
        documents: [],
        total: 0,
        similarity_factors: [],
      };
    }

    // Populate thông tin
    const documents = await Document.find({
      _id: { $in: documentIds },
      is_deleted: false, // Double check
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

    // Sắp xếp theo score
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
        elasticsearch_score: scores[doc._id.toString()] || {},
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
    throw new Error(`Lỗi lấy tài liệu tương tự cho admin: ${error.message}`);
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

  if (!["LIKE", "DISLIKE", "UNREACT"].includes(reactionType)) {
    throw new Error(
      "Loại reaction không hợp lệ. Chỉ chấp nhận: LIKE, DISLIKE, UNREACT"
    );
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
    // Nếu chưa phản ứng, tạo mới và cộng điểm
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

    // Chỉ cộng điểm khi vừa đánh giá vừa bình luận
    try {
      const Comment = require("../models/comment.model");
      const existingComment = await Comment.findOne({
        doc: documentId,
        user: userId,
      });

      if (existingComment) {
        // Kiểm tra xem user đã nhận điểm cho việc vừa comment vừa đánh giá document này chưa
        const existingBonusTransaction = await PointTransaction.findOne({
          user: userId,
          type: "EARN",
          reason: { $regex: "Thưởng comment và đánh giá tài liệu" },
          doc: documentId,
        });

        if (!existingBonusTransaction) {
          // User đã comment và vừa reaction → cộng 1 điểm
          await earnPoints(
            userId,
            1,
            `Thưởng comment và đánh giá tài liệu ${doc.title}`,
            documentId
          );

          // Tạo notification cho điểm thưởng
          const { notifyPointsEarned } = require("./notification.service");
          await notifyPointsEarned(
            userId,
            1,
            `Thưởng comment và đánh giá tài liệu ${doc.title}`
          );
        }
      }
    } catch (pointError) {
      console.error("Error creating reaction points:", pointError);
      // Không làm fail việc reaction nếu cộng điểm thất bại
    }
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

const requestEditDocument = async (documentId, reason) => {
  // Kiểm tra tài liệu tồn tại
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Tài liệu không tồn tại");
  }

  // Kiểm tra trạng thái hiện tại
  if (document.status !== "APPROVED") {
    throw new Error("Tài liệu không thể yêu cầu chỉnh sửa");
  }

  // Tạo yêu cầu chỉnh sửa
  document.status = "REQUESTED_EDIT";
  await document.save();
};

const incrementViewCount = async (documentId, userId) => {
  // Chỉ kiểm tra tài liệu tồn tại và đã được duyệt
  const document = await Document.findById(documentId);

  if (!document) {
    throw new Error("Tài liệu không tồn tại");
  }

  if (document.status !== "APPROVED") {
    throw new Error("Tài liệu chưa được duyệt hoặc không khả dụng");
  }

  // Tăng view count trong Document model
  const updatedDocument = await Document.findByIdAndUpdate(
    documentId,
    { $inc: { view: 1 } },
    { new: true }
  );

  // Cập nhật thống kê view cũ (nếu cần)
  try {
    await updateDocumentStats(documentId, document.user.toString(), "view");
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê view cũ:", statsError);
  }

  // Cập nhật thống kê view mới
  try {
    await updateViewCount();
  } catch (statsError) {
    console.error("Lỗi cập nhật thống kê view mới:", statsError);
  }

  return {
    documentId,
    newViewCount: updatedDocument.view,
  };
};

module.exports = {
  getAllDocuments,
  getNewestDocuments,
  getFeaturedDocuments,
  getRecommendedDocuments,
  createDocument,
  deleteDocument,
  updateDocument,
  getDocumentById,
  getDocumentsBySubject,
  getPendingDocuments,
  getMyPendingDocuments,
  getMyDocuments,
  createDownloadLink,
  processDownload,
  markDownloadSuccess,
  changeAllShareLink,
  getSimilarDocuments,
  getSimilarDocumentsForAdmin,
  reactionDocument,
  getDocumentReactions,
  canViewDocument,
  addToHistory,
  getReadHistory,
  getDocumentsByUserId,
  incrementViewCount,
  canCreateEmbedding,
  embeddinngDocument,
  requestEditDocument,
};

const hasDocumentManageRole = async (accountId, documentId) => {
  const assignments = await Assignment.find({
    account: accountId,
    is_active: true,
  }).populate("role");
  const userRoles = assignments.filter(
    (assignment) =>
      assignment.role.permissions.includes("MANAGE_DOCUMENT") ||
      assignment.role.permissions.includes("ALL")
  );
  return userRoles.some(
    (role) =>
      role.role.permissions.includes("MANAGE_DOCUMENT") ||
      role.role.permissions.includes("ALL")
  );
};

const deleteFromHistoryIfHave = async (documentId, userId) => {
  try {
    const user = await User.findByIdAndUpdate(userId, {
      $pull: {
        read_history: {
          document: documentId,
        },
      },
    });
    if (!user) {
      throw new Error("Người dùng không tồn tại");
    }
  } catch (error) {
    throw new Error(`Lỗi xóa lịch sử đọc: ${error.message}`);
  }
};
