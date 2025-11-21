require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const { sequelize } = require('./src/models');
require('./src/config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Session config
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard_cat',
    resave: false,
    saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// View engine
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Routes
// app.use('/', require('./src/routes/index'));
app.use('/auth', require('./src/routes/auth'));
app.use('/actions', require('./src/routes/actions'));
app.use('/users', require('./src/routes/users'));

app.get('/', async (req, res) => {
    try {
        let actions = [];
        if (req.user) {
            const { Action } = require('./src/models');
            actions = await Action.findAll({
                where: { UserId: req.user.id },
                order: [['createdAt', 'DESC']]
            });
        }
        res.render('dashboard', { user: req.user, actions });
    } catch (err) {
        console.error('Error fetching actions:', err);
        res.render('dashboard', { user: req.user, actions: [] });
    }
});

// Start server
sequelize.sync().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
