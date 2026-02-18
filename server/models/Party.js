const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Party = sequelize.define('Party', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    host_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    share_code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        comment: '分享码',
    },
    status: {
        type: DataTypes.ENUM('active', 'locked'),
        allowNull: false,
        defaultValue: 'active',
        comment: '进行中 / 已锁定',
    },
    total_budget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: '实时预算',
    },
    available_dish_ids: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
        comment: '可点菜品ID列表，为 null 则不限制',
    },
}, {
    tableName: 'parties',
});

module.exports = Party;
