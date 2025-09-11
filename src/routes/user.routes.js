const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireUserRole } = require('../middlewares/auth.middleware');

router.get('/', requireUserRole, userController.getUsers);

module.exports = router;