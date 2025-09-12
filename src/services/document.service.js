const Document = require("../models/document.model");
const User = require("../models/user.model");

const getNewestDocuments = async (payload, page = 1, limit = 5) => {
    let user = null;
    if (payload && payload.userId) {
        user = await User.findById(payload.userId);
    }

    
    const skip = (page - 1) * limit;

    let query = {
        status: "approved",
        public_mode: "public"
    };

    if (user && user.organization) {
        query = {
            status: "approved",
            $or: [
                { public_mode: "public" },
                { public_mode: "share_organization", organization: user.organization }
            ]
        };
    }

    const [documents, total] = await Promise.all([
        Document.find(query)
            .skip(skip)
            .limit(limit),
        Document.countDocuments(query)
    ]);
    console.log('documents', documents);
    console.log('total', total);
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

module.exports = {
    getNewestDocuments
};