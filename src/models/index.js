const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    googleId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    displayName: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING
    }
});

const Action = sequelize.define('Action', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('created', 'scraping', 'scraped', 'processing', 'completed'),
        defaultValue: 'created'
    },
    folderPath: {
        type: DataTypes.STRING
    }
});

const ActionItem = sequelize.define('ActionItem', {
    type: {
        type: DataTypes.ENUM('image', 'video'),
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    metadata: {
        type: DataTypes.JSON // prompt, voiceover text, etc.
    },
    selected: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

User.hasMany(Action);
Action.belongsTo(User);

Action.hasMany(ActionItem);
ActionItem.belongsTo(Action);

module.exports = {
    sequelize,
    User,
    Action,
    ActionItem
};
