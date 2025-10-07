const { Client } = require('@elastic/elasticsearch');

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

// Tạo index cho documents
const createDocumentIndex = async () => {
  try {
    const indexExists = await client.indices.exists({ index: 'documents' });
    
    if (!indexExists) {
      await client.indices.create({
        index: 'documents',
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: { 
                type: 'text', 
                analyzer: 'standard',
                fields: {
                  suggest: {
                    type: 'completion',
                    analyzer: 'simple'
                  }
                }
              },
              author: { 
                type: 'text',
                fields: {
                  suggest: {
                    type: 'completion'
                  }
                }
              },
              keyword: { 
                type: 'text',
                fields: {
                  suggest: {
                    type: 'completion'
                  }
                }
              },
              user: { type: 'keyword' },
              organization: { type: 'keyword' },
              subject: { type: 'keyword' },
              public_mode: { type: 'keyword' },
              status: { type: 'keyword' },
              is_deleted: { type: 'boolean' },
              created_at: { type: 'date' },
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