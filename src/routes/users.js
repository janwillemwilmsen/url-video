const express = require('express');
const router = express.Router();
const { User } = require('../models');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    console.log('Is Authenticated:', req.isAuthenticated());
    console.log('User:', req.user);
    console.log('Session:', req.session);
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

// GET /users/profile
router.get('/profile', isAuthenticated, (req, res) => {
    res.render('profile', { user: req.user });
});

// GET /users/list
router.get('/list', isAuthenticated, async (req, res) => {
    try {
        const users = await User.findAll();
        res.render('users', { user: req.user, users: users });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
