const { client } = require('../config/elasticsearch');
const Document = require('../models/document.model');
const Account = require('../models/account.model');
const User = require('../models/user.model');
const { processDocumentAndCreateEmbedding } = require('../utils/tranformers')

/**
 * Index một document vào Elasticsearch
 */
const indexDocument = async (doc) => {
    try {
        await client.index({
            index: 'documents',
            id: doc._id.toString(),
            body: {
                id: doc._id.toString(),
                title: doc.title,
                author: doc.author || [],
                content_vector: doc.content_vector || [],
                keyword: doc.keyword || [],
                user: doc.user.toString(),
                organization: doc.organization ? doc.organization.toString() : null,
                subject: doc.subject ? doc.subject.toString() : null,
                public_mode: doc.public_mode,
                status: doc.status,
                is_deleted: doc.is_deleted,
                createdAt: doc.createdAt,
                view: doc.view || 0,
                download_count: doc.download_count || 0,
                last_approved_at: doc.last_approved_at
            }
        });
    } catch (error) {
        console.error('Error indexing document:', error);
    }
};

/**
 * Cập nhật document trong Elasticsearch
 */
const updateDocument = async (docId, updateData) => {
    try {
        await client.update({
            index: 'documents',
            id: docId,
            body: {
                doc: updateData
            }
        });
    } catch (error) {
        console.error('Error updating document in ES:', error);
    }
};

/**
 * Xóa document khỏi Elasticsearch
 */
const deleteDocument = async (docId) => {
    try {
        await client.delete({
            index: 'documents',
            id: docId
        });
    } catch (error) {
        console.error('Error deleting document from ES:', error);
    }
};

/**
 * Search documents với phân quyền
 */
const searchDocuments = async (query, accessFilter, options = {}) => {
    try {
        const { page = 1, limit = 5, ordering = 'last_approved_at', order = -1 } = options;
        const from = (page - 1) * limit;

        // Tính min_score động dựa vào độ dài query
        const queryWords = query.trim().split(/\s+/);
        const queryLength = queryWords.length;
        
        // Query càng dài (nhiều từ) thì yêu cầu score càng cao
        let dynamicMinScore;
        if (queryLength === 1) {
            dynamicMinScore = 10.0;  // 1 từ yêu cầu match tốt
        } else if (queryLength === 2) {
            dynamicMinScore = 30.0;  // 2 từ: yêu cầu cao hơn
        } else {
            dynamicMinScore = 50.0;  // 3+ từ: yêu cầu rất cao
        }

        // Build Elasticsearch query
        const searchQuery = {
            bool: {
                should: [
                    {
                        match: {
                            title: {
                                query,
                                boost: 5,
                                operator: 'or',
                                fuzziness: 'AUTO'
                            }
                        }
                    },
                    {
                        match: {
                            'title.autocomplete': {
                                query,
                                boost: 4
                            }
                        }
                    },
                    {
                        match: {
                            'title.ngram': {
                                query,
                                boost: 3
                            }
                        }
                    },
                    {
                        wildcard: {
                            'title.keyword': {
                                value: `*${query.toLowerCase()}*`,
                                boost: 2
                            }
                        }
                    },
                    // Tương tự cho author và keyword
                    { match: { author: { query, boost: 3, fuzziness: 'AUTO' } } },
                    { match: { 'author.autocomplete': { query, boost: 2 } } },
                    { match: { keyword: { query, boost: 3, fuzziness: 'AUTO'} } },
                    { match: { 'keyword.autocomplete': { query, boost: 2 } } }
                ],
                minimum_should_match: 1,
                filter: [
                    { term: { status: 'APPROVED' } },
                    { term: { is_deleted: false } },
                    accessFilter // Điều kiện phân quyền
                ]
            }
        };

        const response = await client.search({
            index: 'documents',
            body: {
                query: searchQuery,
                from,
                size: limit,
                min_score: dynamicMinScore,
                sort: [
                    { _score: { order: 'desc' } },
                    { [ordering]: { order: order === -1 ? 'desc' : 'asc' } }
                ],
                highlight: {
                    fields: {
                        title: {},
                        author: {},
                        keyword: {}
                    }
                }
            }
        });

        console.log(`📊 ES returned ${response.hits.hits.length} results out of ${response.hits.total.value} total`);
        
        // ✅ Log chi tiết top results
        if (response.hits.hits.length > 0) {
            console.log('📋 Top results:');
            response.hits.hits.forEach((hit, index) => {
                console.log(`  ${index + 1}. [Score: ${hit._score.toFixed(2)}] ${hit._source.title}`);
                console.log(`     Highlights:`, Object.keys(hit.highlight || {}));
                if (hit.highlight) {
                    if (hit.highlight.title) {
                        console.log(`     Title: ${hit.highlight.title[0]}`);
                    }
                    if (hit.highlight.keyword) {
                        console.log(`     Keyword: ${hit.highlight.keyword.join(', ')}`);
                    }
                }
            });
        } else {
            console.log('⚠️ No results found with min_score >= ' + dynamicMinScore);
        }

        const documentIds = response.hits.hits.map(hit => hit._id);

        // Lấy thông tin đầy đủ từ MongoDB
        const documents = await Document.find({ _id: { $in: documentIds } })
            .populate({
                path: "user",
                select: "_id first_name last_name avatar doc_count",
                populate: {
                    path: "organization",
                    select: "_id name",
                },
            })
            .populate({ path: "organization", select: "_id name" })
            .populate({ path: "subject", select: "_id name" });

        // Sắp xếp lại theo thứ tự Elasticsearch trả về
        const sortedDocuments = documentIds.map(id =>
            documents.find(doc => doc._id.toString() === id)
        ).filter(Boolean);

        return {
            documents: sortedDocuments,
            total: response.hits.total.value,
            highlights: response.hits.hits.reduce((acc, hit) => {
                acc[hit._id] = hit.highlight;
                return acc;
            }, {})
        };
    } catch (error) {
        console.error('Error searching documents:', error);
        throw error;
    }
};

/**
 * Lấy gợi ý search
 */
const getSuggestions = async (query, userId, limit = 10) => {
    try {
        // Kiểm tra user là admin
        const isAdmin = userId ? await Account.findOne({ user: userId, is_admin: true }) : false;

        let searchQuery;

        if (isAdmin) {
            // Admin: Chỉ cần document không bị xóa
            searchQuery = {
                bool: {
                    must: [
                        {
                            bool: {
                                should: [
                                    { match: { title: { query, boost: 3 } } },
                                    { match: { author: { query, boost: 2 } } },
                                    { match: { keyword: { query, boost: 2 } } }
                                ]
                            }
                        }
                    ],
                    filter: [
                        { term: { is_deleted: false } }
                    ]
                }
            };
        } else {
            // User thường: Áp dụng đầy đủ phân quyền
            let user = null;
            let sharedDocIds = [];

            if (userId) {
                user = await User.findById(userId).select('organization shared_documents');
                if (user && user.shared_documents && user.shared_documents.length > 0) {
                    sharedDocIds = user.shared_documents.map(item => item.document.toString());
                }
            }

            // Build access filter
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
                                        { term: { organization: user.organization.toString() } }
                                    ]
                                }
                            },
                            { term: { user: user._id.toString() } } // Own documents
                        ]
                    }
                };

                // Thêm shared documents (PRIVATE_SHARED)
                if (sharedDocIds.length > 0) {
                    accessFilter.bool.should.push({
                        bool: {
                            must: [
                                { term: { public_mode: "PRIVATE_SHARED" } },
                                { terms: { id: sharedDocIds } }
                            ]
                        }
                    });
                }
            } else {
                // Guest user: Chỉ xem PUBLIC
                accessFilter = { term: { public_mode: "PUBLIC" } };
            }

            searchQuery = {
                bool: {
                    must: [
                        {
                            bool: {
                                should: [
                                    { match: { title: { query, boost: 3 } } },
                                    { match: { author: { query, boost: 2 } } },
                                    { match: { keyword: { query, boost: 2 } } }
                                ]
                            }
                        }
                    ],
                    filter: [
                        { term: { status: 'APPROVED' } }, // Chỉ approved documents
                        { term: { is_deleted: false } },
                        accessFilter // Điều kiện phân quyền
                    ]
                }
            };
        }

        const response = await client.search({
            index: 'documents',
            body: {
                query: searchQuery,
                size: limit,
                sort: [
                    { _score: { order: 'desc' } },
                    { last_approved_at: { order: 'desc' } }
                ],
                _source: ['title', 'author', 'keyword'] // Chỉ lấy fields cần thiết cho suggestion
            }
        });

        // Extract suggestions từ results
        const suggestions = new Set();

        response.hits.hits.forEach(hit => {
            const doc = hit._source;

            // Add title matches
            if (doc.title && doc.title.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(doc.title);
            }

            // Add author matches
            if (doc.author) {
                doc.author.forEach(author => {
                    if (author.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.add(author);
                    }
                });
            }

            // Add keyword matches
            if (doc.keyword) {
                doc.keyword.forEach(keyword => {
                    if (keyword.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.add(keyword);
                    }
                });
            }
        });

        return Array.from(suggestions).slice(0, limit);

    } catch (error) {
        console.error('Error getting suggestions:', error);
        return [];
    }
};

// dành cho user thường, filter đầu vào để giảm số lượng tài liệu áp dụng cosine
const findSimilarDocuments = async (sourceDoc, userId, limit = 5) => {
    try {
        // Kiểm tra admin
        const isAdmin = userId ? await Account.findOne({ user: userId, is_admin: true }) : false;

        let accessFilter;

        if (isAdmin) {
            accessFilter = { term: { is_deleted: false } };
        } else {
            // Build access filter...
            let user = null;
            let sharedDocIds = [];

            if (userId) {
                user = await User.findById(userId).select('organization shared_documents');
                if (user && user.shared_documents && user.shared_documents.length > 0) {
                    sharedDocIds = user.shared_documents.map(item => item.document.toString());
                }
            }

            if (user && user.organization) {
                accessFilter = {
                    bool: {
                        should: [
                            { term: { public_mode: "PUBLIC" } },
                            {
                                bool: {
                                    must: [
                                        { term: { public_mode: "SHARE_ORGANIZATION" } },
                                        { term: { organization: user.organization.toString() } }
                                    ]
                                }
                            },
                            { term: { user: user._id.toString() } }
                        ]
                    }
                };

                if (sharedDocIds.length > 0) {
                    accessFilter.bool.should.push({
                        bool: {
                            must: [
                                { term: { public_mode: "PRIVATE_SHARED" } },
                                { terms: { id: sharedDocIds } }
                            ]
                        }
                    });
                }
            } else {
                accessFilter = { term: { public_mode: "PUBLIC" } };
            }
        }

        const subjectId = sourceDoc.subject?._id || sourceDoc.subject;

        const moreLikeThisQuery = {
            bool: {
                must: [
                    { exists: { field: 'content_vector' } }
                ],
                should: [
                    {
                        more_like_this: {
                            fields: ['title^3', 'author^2', 'keyword^2'],
                            like: [
                                {
                                    _index: 'documents',
                                    _id: sourceDoc._id.toString()
                                }
                            ],
                            min_term_freq: 1,
                            max_query_terms: 15,
                            min_doc_freq: 1,
                            boost: 1.0
                        }
                    },
                    // Thêm boost cho cùng subject
                    ...(subjectId ? [{
                        term: {
                            subject: {
                                value: subjectId.toString(),
                                boost: 3.0
                            }
                        }
                    }] : []),
                    // Thêm boost cho cùng người đăng
                    {
                        term: {
                            user: {
                                value: sourceDoc.user.toString(),
                                boost: 2.0 // Boost cho cùng user
                            }
                        }
                    },
                    // Thêm boost cho cùng author
                    ...(sourceDoc.author && sourceDoc.author.length > 0 ?
                        sourceDoc.author.map(author => ({
                            term: {
                                author: {
                                    value: author,
                                    boost: 1.5
                                }
                            }
                        })) : []
                    ),
                    // Thêm boost cho cùng organization
                    ...(sourceDoc.organization ? [{
                        term: {
                            organization: {
                                value: sourceDoc.organization.toString(),
                                boost: 1.2
                            }
                        }
                    }] : [])
                ],
                filter: [
                    accessFilter
                ],
                must_not: [
                    { term: { _id: sourceDoc._id.toString() } }
                ]
            }
        };

        // Chỉ filter APPROVED cho user thường
        if (!isAdmin) {
            moreLikeThisQuery.bool.filter.push({ term: { status: 'APPROVED' } });
        }

        // if (subjectId) {
        //     moreLikeThisQuery.bool.should = [
        //         {
        //             term: {
        //                 subject: {
        //                     value: subjectId.toString(),
        //                     boost: 3.0
        //                 }
        //             }
        //         }
        //     ];
        // }
        const docInElasticsearch = await client.get({
            index: 'documents',
            id: sourceDoc._id.toString()
        });
        const sourceDocEmbedding = docInElasticsearch._source.content_vector;
        const semanticQuery = {
            script_score: {
                query: moreLikeThisQuery,
                script: {
                    source: "cosineSimilarity(params.queryVector, 'content_vector') + 1.0",
                    params: {
                        queryVector: sourceDocEmbedding
                    }
                }
            }
        };

        const response = await client.search({
            index: 'documents',
            body: {
                query: semanticQuery,
                size: limit,
                sort: [
                    { _score: { order: 'desc' } },
                    { last_approved_at: { order: 'desc' } }
                ]
            }
        });

        const hits = response.hits;

        if (!hits || !hits.hits) {
            console.log('⚠️ No hits found in ES response');
            return { documentIds: [], scores: {} };
        }

        const documentsWithScores = hits.hits.map(hit => {
            const doc = hit._source;
            let customScore = hit._score;
            let similarityFactors = [];

            // Thêm điểm cho các yếu tố tương tự
            // Cùng môn học: +5 điểm
            if (doc.subject === subjectId?.toString()) {
                customScore += 0.5;
                similarityFactors.push('same_subject');
            }

            // Cùng người đăng: +5 điểm
            if (doc.user === sourceDoc.user.toString()) {
                customScore += 0.5;
                similarityFactors.push('same_uploader');
            }

            // Cùng author: +3 điểm cho mỗi author match
            if (sourceDoc.author && doc.author) {
                const commonAuthors = doc.author.filter(author =>
                    sourceDoc.author.includes(author)
                );
                if (commonAuthors.length > 0) {
                    customScore += (commonAuthors.length * 0.2);
                    similarityFactors.push('same_author');
                }
            }

            // Cùng keyword: +3 điểm cho mỗi keyword match
            if (sourceDoc.keyword && doc.keyword) {
                const commonKeywords = doc.keyword.filter(keyword =>
                    sourceDoc.keyword.includes(keyword)
                );
                if (commonKeywords.length > 0) {
                    customScore += (commonKeywords.length * 0.3);
                    similarityFactors.push('same_keywords');
                }
            }

            // Cùng organization: +2 điểm
            if (sourceDoc.organization && doc.organization === sourceDoc.organization.toString()) {
                customScore += 0.2;
                similarityFactors.push('same_organization');
            }

            // Title similarity: +4 điểm nếu có từ chung
            if (sourceDoc.title && doc.title) {
                const titleWords = sourceDoc.title.toLowerCase().split(/\s+/);
                const docTitleWords = doc.title.toLowerCase().split(/\s+/);
                const hasCommonWords = titleWords.some(word =>
                    word.length > 3 && docTitleWords.some(docWord =>
                        docWord.includes(word) || word.includes(docWord)
                    )
                );
                if (hasCommonWords) {
                    customScore += 0.4;
                    similarityFactors.push('similar_title');
                }
            }

            return {
                id: hit._id,
                score: customScore,
                elasticsearch_score: hit._score,
                similarity_factors: similarityFactors,
                source: doc
            };
        });

        // Sắp xếp theo custom score và lấy top results
        const topDocuments = documentsWithScores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        const documentIds = topDocuments.map(doc => doc.id);
        const scores = topDocuments.reduce((acc, doc) => {
            acc[doc.id] = {
                total_score: doc.score,
                elasticsearch_score: doc.elasticsearch_score,
                similarity_factors: doc.similarity_factors
            };
            return acc;
        }, {});

        console.log('📊 Top documents scores:', topDocuments.slice(0, 3).map(d => ({
            id: d.id,
            score: d.score,
            factors: d.similarity_factors
        })));

        return { documentIds, scores };

    } catch (error) {
        console.error('❌ Error finding similar documents with ES:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 3)
        });
        return { documentIds: [], scores: {} };
    }
};

//Dành cho admin, chỉ tìm trên vector của toàn bộ, ko filter đầu vào
const findSimilarDocumentsForAdmin = async (sourceDocId, limit = 10) => {
    try {
        // Lấy document nguồn từ MongoDB
        const sourceDoc = await Document.findById(sourceDocId);
        if (!sourceDoc) {
            throw new Error('Source document not found');
        }

        // Lấy content_vector từ Elasticsearch
        const docInElasticsearch = await client.get({
            index: 'documents',
            id: sourceDoc._id.toString()
        });

        const sourceDocEmbedding = docInElasticsearch._source.content_vector;

        if (!sourceDocEmbedding || sourceDocEmbedding.length === 0) {
            console.log('⚠️ Source document has no content_vector');
            return { documentIds: [], scores: {} };
        }

        // Query đơn giản: chỉ tính cosine similarity
        const semanticQuery = {
            script_score: {
                query: {
                    bool: {
                        must: [
                            { exists: { field: 'content_vector' } }
                        ],
                        filter: [
                            { term: { is_deleted: false } }
                        ],
                        must_not: [
                            { term: { _id: sourceDoc._id.toString() } }
                        ]
                    }
                },
                script: {
                    source: "cosineSimilarity(params.queryVector, 'content_vector') + 1.0",
                    params: {
                        queryVector: sourceDocEmbedding
                    }
                }
            }
        };

        const response = await client.search({
            index: 'documents',
            body: {
                query: semanticQuery,
                size: limit,
                min_score: 1.95,
                sort: [
                    { _score: { order: 'desc' } }
                ]
            }
        });

        const hits = response.hits;

        if (!hits || !hits.hits) {
            console.log('⚠️ No hits found in ES response');
            return { documentIds: [], scores: {} };
        }

        const documentIds = [];
        const scores = {};

        for (const hit of hits.hits) {
            const docId = hit._source.id;
            documentIds.push(docId);
            scores[docId] = {
                cosineSimilarity: hit._score
            };
        }

        console.log(`✅ Found ${documentIds.length} similar documents for admin`);
        console.log('📊 Scores:', scores);

        return { documentIds, scores };

    } catch (error) {
        console.error('❌ Error in findSimilarDocumentsForAdmin:', error);
        throw error;
    }
};

const syncAllDocuments = async () => {
    try {
        console.log('🔄 Starting sync documents to Elasticsearch...');

        const documents = await Document.find({ is_deleted: false });

        let successCount = 0;
        let failedCount = 0;

        for (const doc of documents) {
            try {
                console.log(`📘 Processing document: ${doc._id}`);

                // 🧩 Tạo embedding từ file
                const result = await processDocumentAndCreateEmbedding(doc.url, doc.file_type);

                if (!result.embedding || result.embedding.length === 0) {
                    console.warn(`⚠️ Embedding rỗng cho document ${doc._id}`);
                    failedCount++;
                    continue;
                }

                // 🧠 Gán embedding và index vào ES
                doc.content_vector = result.embedding;
                await indexDocument(doc);

                console.log(`✅ Indexed document ${doc._id}`);
                successCount++;
            } catch (err) {
                failedCount++;
                console.error(`❌ Error processing doc ${doc._id}: ${err.message}`);
                // Không throw lại => để vòng for tiếp tục
            }
        }

        console.log(`✅ Synced ${documents.length} documents to Elasticsearch`);
    } catch (error) {
        console.error('❌ Error syncing documents:', error);
    }
};

module.exports = {
    indexDocument,
    updateDocument,
    deleteDocument,
    searchDocuments,
    getSuggestions,
    findSimilarDocuments,
    findSimilarDocumentsForAdmin,
    syncAllDocuments
};