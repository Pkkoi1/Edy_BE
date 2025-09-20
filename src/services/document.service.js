const Document = require("../models/document.model");
const User = require("../models/user.model");
const Organization = require("../models/organization.model");
const Subject = require("../models/subject.model");
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
    ordering = "createdAt",
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
            { user: user._id }
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
                "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count createdAt"
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
    let query = { status: { $in: ["APPROVED", "PENDING_SUMMARY"] }, is_deleted: false, subject };
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
                "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count createdAt"
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
        is_deleted: false 
    };

    // Thêm điều kiện search nếu có
    if (searchOr.length > 0) {
        query.$and = [
            { user: user._id },
            { $or: searchOr },
            { is_deleted: false }
        ];
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
        "status"
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
                "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count status createdAt"
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

const getDocumentPreviewContent = async (doc) => { };

const getDocumentById = async (id) => {
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
        status: { $in: ["PENDING", "PENDING_SUMMARY"] },
        is_deleted: false
    };

    // Thêm điều kiện search nếu có
    if (searchOr.length > 0) {
        query.$and = [
            { status: { $in: ["PENDING", "PENDING_SUMMARY"] } },
            { $or: searchOr },
            { is_deleted: false }
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
        "status"
    ];

    filterFields.forEach((field) => {
        if (filters[field] !== undefined) {
            // Xử lý đặc biệt cho status để không ghi đè query cơ bản
            if (field === "status") {
                const allowedStatuses = ["PENDING", "PENDING_SUMMARY"];
                if (Array.isArray(filters[field])) {
                    const validStatuses = filters[field].filter(s => allowedStatuses.includes(s));
                    if (validStatuses.length > 0) {
                        query.status = { $in: validStatuses };
                    }
                } else if (allowedStatuses.includes(filters[field])) {
                    query.status = filters[field];
                }
            } else {
                // Xử lý các field khác
                if (Array.isArray(filters[field])) {
                    query[field] = { $in: filters[field] };
                } else {
                    query[field] = filters[field];
                }
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
                "_id user title author published_year publisher page file_type intensive url organization subject level view download_count comment_count status createdAt"
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

module.exports = {
    getNewestDocuments,
    createDocument,
    deleteDocument,
    updateDocument,
    getDocumentById,
    getDocumentsBySubject,
    getPendingDocuments,
    getMyDocuments,
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
}
