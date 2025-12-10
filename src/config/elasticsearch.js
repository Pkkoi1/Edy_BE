const { Client } = require('@elastic/elasticsearch');

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USER_NAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  }
});

// Tạo index cho documents
const createDocumentIndex = async () => {
  try {
    const indexExists = await client.indices.exists({ index: 'documents' });

    if (!indexExists) {
      await client.indices.create({
        index: 'documents',
        body: {
           settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            max_ngram_diff: 10,
            analysis: {
              tokenizer: {
                ngram_tokenizer: {
                  type: 'ngram',
                  min_gram: 2,
                  max_gram: 10,
                  token_chars: ['letter', 'digit']
                }
              },
              filter: {
                vietnamese_stop: {
                  type: 'stop',
                  stopwords: ['của', 'và', 'các', 'trong', 'để', 'với', 'cho', 'về', 'được', 'có']
                },
                edge_ngram_filter: {
                  type: 'edge_ngram',
                  min_gram: 2,
                  max_gram: 20
                }
              },
              normalizer: {
                lowercase_normalizer: {
                  type: 'custom',
                  filter: ['lowercase', 'asciifolding']
                }
              },
              analyzer: {
                // Analyzer cho tiếng Việt và các ký tự đặc biệt
                vietnamese_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding', // Chuyển à→a, ă→a, â→a, é→e,...
                    'word_delimiter_graph', // Tách Delta_Lake → Delta, Lake
                    'vietnamese_stop'
                  ]
                },
                // Analyzer cho search (ít aggressive hơn)
                vietnamese_search: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding'
                  ]
                },
                // Analyzer cho autocomplete
                autocomplete_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'edge_ngram_filter'
                  ]
                },
                // Analyzer cho search autocomplete
                autocomplete_search: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding'
                  ]
                },
                // N-gram analyzer cho partial matching
                ngram_analyzer: {
                  type: 'custom',
                  tokenizer: 'ngram_tokenizer',
                  filter: ['lowercase', 'asciifolding']
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                search_analyzer: 'vietnamese_search',
                fields: {
                  // Exact match
                  keyword: { 
                    type: 'keyword',
                    normalizer: 'lowercase'
                  },
                  // Autocomplete
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'autocomplete_search'
                  },
                  // N-gram cho partial match
                  ngram: {
                    type: 'text',
                    analyzer: 'ngram_analyzer'
                  },
                  // Suggestion
                  suggest: {
                    type: 'completion',
                    analyzer: 'vietnamese_analyzer'
                  }
                }
              },
              author: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                search_analyzer: 'vietnamese_search',
                fields: {
                  keyword: { 
                    type: 'keyword' 
                  },
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'autocomplete_search'
                  },
                  suggest: {
                    type: 'completion',
                    analyzer: 'vietnamese_analyzer'
                  }
                }
              },
              content_vector: {
                type: "dense_vector",
                dims: 384,
                index: true,
                similarity: "cosine"
              },
              keyword: {
                type: 'text',
                analyzer: 'vietnamese_analyzer',
                search_analyzer: 'vietnamese_search',
                fields: {
                  keyword: { 
                    type: 'keyword' 
                  },
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'autocomplete_search'
                  },
                  suggest: {
                    type: 'completion',
                    analyzer: 'vietnamese_analyzer'
                  }
                }
              },
              user: { type: 'keyword' },
              organization: { type: 'keyword' },
              subject: { type: 'keyword' },
              public_mode: { type: 'keyword' },
              status: { type: 'keyword' },
              is_deleted: { type: 'boolean' },
              createdAt: { type: 'date' },
              last_approved_at: { type: 'date' }
            }
          }
        }
      });
      console.log('Tạo index "documents" thành công');
    }
  } catch (error) {
    console.error('Có lỗi xảy ra khi tạo index:', error);
  }
};

module.exports = { client, createDocumentIndex };