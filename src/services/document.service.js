const Document = require("../models/document.model");
const User = require("../models/user.model");
const cloudinary = require('cloudinary').v2;

const getNewestDocuments = async ({
    payload,
    search,
    ordering = 'createdAt',
    order = -1,
    page = 1,
    limit = 5,
    ...filters
}) => {
    let user = null;
    let sharedDocIds = [];
    if (payload && payload.userId) {
        user = await User.findById(payload.userId).select('organization shared_documents');
        if (user && user.shared_documents && user.shared_documents.length > 0) {
            sharedDocIds = user.shared_documents.map(item => item.document);
        }
    }

    const skip = (page - 1) * limit;

     // Điều kiện quyền truy cập
    let accessOr = [];
    if (user && user.organization) {
        accessOr = [
            { public_mode: "public" },
            { public_mode: "share_organization", organization: user.organization }
        ];
        if (sharedDocIds.length > 0) {
            accessOr.push({ _id: { $in: sharedDocIds } });
        }
    } else {
        accessOr = [{ public_mode: "public" }];
        if (sharedDocIds.length > 0) {
            accessOr.push({ _id: { $in: sharedDocIds } });
        }
    }

    // Điều kiện tìm kiếm
    let searchOr = [];
    if (search) {
        searchOr = [
            { title: { $regex: search, $options: 'i' } },
            { author: { $elemMatch: { $regex: search, $options: 'i' } } },
            { keyword: { $elemMatch: { $regex: search, $options: 'i' } } }
        ];
    }

    // Kết hợp quyền truy cập và tìm kiếm
    let query = { status: "approved", is_deleted: false };
    if (searchOr.length > 0) {
        query.$and = [
            { $or: accessOr },
            { $or: searchOr },
            { is_deleted: false }
        ];
    } else {
        query.$or = accessOr;
    }

    // Filter các trường
    const filterFields = [
        'organization', 'publisher', 'published_year', 'intensive',
        'author', 'user', 'keyword', 'doc_type', 'level', 'subject'
    ];

    filterFields.forEach(field => {
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
            .select('_id user title author published_year publisher page file_type intensive organization view download_count comment_count createdAt')
            .populate({ path: 'user', select: '_id first_name last_name' })
            .populate({ path: 'organization', select: '_id name' }),
        Document.countDocuments(query)
    ]);
    const totalPages = Math.ceil(total / limit);
    const have_next = page < totalPages;
    return {
        documents,
        total,
        page,
        totalPages,
        have_next
    };
};

const getDocumentsBySubject = async ({
    subject,
    payload,
    search,
    ordering = 'createdAt',
    order = -1,
    page = 1,
    limit = 5,
    ...filters
}) => {
    let user = null;
    let sharedDocIds = [];
    if (payload && payload.userId) {
        user = await User.findById(payload.userId).select('organization shared_documents');
        if (user && user.shared_documents && user.shared_documents.length > 0) {
            sharedDocIds = user.shared_documents.map(item => item.document);
        }
    }

    const skip = (page - 1) * limit;

    // Điều kiện quyền truy cập
    let accessOr = [];
    if (user && user.organization) {
        accessOr = [
            { public_mode: "public" },
            { public_mode: "share_organization", organization: user.organization }
        ];
        if (sharedDocIds.length > 0) {
            accessOr.push({ _id: { $in: sharedDocIds } });
        }
    } else {
        accessOr = [{ public_mode: "public" }];
        if (sharedDocIds.length > 0) {
            accessOr.push({ _id: { $in: sharedDocIds } });
        }
    }

    // Điều kiện tìm kiếm
    let searchOr = [];
    if (search) {
        searchOr = [
            { title: { $regex: search, $options: 'i' } },
            { author: { $elemMatch: { $regex: search, $options: 'i' } } },
            { keyword: { $elemMatch: { $regex: search, $options: 'i' } } }
        ];
    }

    // Kết hợp quyền truy cập, tìm kiếm và lọc subject
    let query = { status: "approved", is_deleted: false, subject };
    if (searchOr.length > 0) {
        query.$and = [
            { $or: accessOr },
            { $or: searchOr },
            { subject },
            { is_deleted: false }
        ];
    } else {
        query.$or = accessOr;
        query.subject = subject;
    }

    // Filter các trường khác
    const filterFields = [
        'organization', 'publisher', 'published_year', 'intensive',
        'author', 'user', 'keyword', 'doc_type', 'level'
    ];

    filterFields.forEach(field => {
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
            .select('_id user title author published_year publisher page file_type intensive organization view download_count comment_count createdAt')
            .populate({ path: 'user', select: '_id first_name last_name' })
            .populate({ path: 'organization', select: '_id name' }),
        Document.countDocuments(query)
    ]);
    const totalPages = Math.ceil(total / limit);
    const have_next = page < totalPages;
    return {
        documents,
        total,
        page,
        totalPages,
        have_next
    };
};

// const getDocumentsAccessible = async (user, page = 1, limit = 5) 

const getCoverPage = (url) => {
    // Ví dụ với file PDF
    if (!url) return null;
    return cloudinary.url(url, { page: 1, format: 'jpg' });
}

const createDocument = async (data) => {
    const docData = { ...data, cover_page: data.cover_page || getCoverPage(data.url) };
    const doc = new Document(docData);
    await doc.save();
    return doc;
};

const deleteDocument = async (id) => {
    const doc = await Document.findByIdAndUpdate(id, { is_deleted: true }, { new: true });
    return doc;
};

const updateDocument = async (id, data) => {
    // Không cho sửa trường is_deleted qua update này
    if ('is_deleted' in data) delete data.is_deleted;
    const doc = await Document.findByIdAndUpdate(id, data, { new: true });
    return doc;
};

const getDocumentById = async (id) => {
    return Document.findOne({ _id: id, is_deleted: false });
};


module.exports = {
    getNewestDocuments,
    createDocument,
    deleteDocument,
    updateDocument,
    getDocumentById,
    getDocumentsBySubject
};