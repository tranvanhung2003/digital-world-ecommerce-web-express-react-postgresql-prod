const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * News Model.
 */
const News = sequelize.define(
  'News',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Mô tả ngắn gọn về tin tức
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Tin tức',
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Danh sách từ khóa liên quan đến tin tức, lưu dưới dạng chuỗi phân cách bằng dấu phẩy
    tags: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Thuộc tính tùy chọn để liên kết tin tức với người dùng (tác giả)
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: 'news',
    timestamps: true,
  },
);

module.exports = News;
