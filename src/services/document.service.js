const Document = require("../models/document.model");
const User = require("../models/user.model");

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
    if (payload && payload.userId) {
        user = await User.findById(payload.userId);
    }

    const skip = (page - 1) * limit;

    // Query cơ bản
    let query = { status: "approved" };

    // Quyền truy cập
    if (user && user.organization) {
        query.$or = [
            { public_mode: "public" },
            { public_mode: "share_organization", organization: user.organization }
        ];
    } else {
        query.public_mode = "public";
    }

    // Search theo từ khóa, title, author, keyword
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { author: { $elemMatch: { $regex: search, $options: 'i' } } },
            { keyword: { $elemMatch: { $regex: search, $options: 'i' } } }
        ];
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
            .limit(limit),
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

module.exports = {
    getNewestDocuments
};