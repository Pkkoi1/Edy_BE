const { getSuggestions } = require('../services/elasticsearch.service');
const User = require('../models/user.model');

exports.getSuggestions = async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const userId = req.user?.userId || null; // Có thể null cho guest

    const suggestions = await getSuggestions(
      query.trim(), 
      userId,
      parseInt(limit)
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy gợi ý tìm kiếm',
      suggestions: []
    });
  }
};