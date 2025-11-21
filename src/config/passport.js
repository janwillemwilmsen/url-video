const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",
    scope: ['profile', 'email']
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const [user] = await User.findOrCreate({
                where: { googleId: profile.id },
                defaults: {
                    displayName: profile.displayName,
                    email: profile.emails[0].value
                }
            });
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
