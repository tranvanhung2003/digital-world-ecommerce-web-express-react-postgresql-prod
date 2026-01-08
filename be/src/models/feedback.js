const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * Feedback Model.
 *
 * Thuộc tính "status" sử dụng ENUM("pending", "reviewed", "resolved")
 * để giới hạn các trạng thái phản hồi.
 */
const Feedback = sequelize.define(
  'Feedback',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed', 'resolved'),
      defaultValue: 'pending',
    },
  },
  {
    tableName: 'feedbacks',
    timestamps: true,
  },
);

module.exports = Feedback;
