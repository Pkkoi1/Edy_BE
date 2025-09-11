const User = require('../models/user.model');
const Account = require('../models/account.model');
const Assignment = require('../models/assignment.model');
const Role = require('../models/role.model');

// ... existing code ...

exports.getUsers = async (req, res) => {
    try{
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message }) 
    }
};

// ... existing code ...