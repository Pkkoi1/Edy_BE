const PointTransaction = require("../models/point_transaction.model");

const createPointTransaction = async (userId, type, amount, reason) => {
  const transaction = new PointTransaction({
    user: userId,
    type,
    point: amount,
    reason,
  });
  await transaction.save();
};

module.exports = {
    createPointTransaction,
};