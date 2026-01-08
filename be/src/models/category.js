const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');

/**
 * Category Model.
 *
 * Sử dụng hook beforeValidate để tự động tạo slug (thuộc tính "slug")
 * từ tên danh mục (thuộc tính "name") trước khi lưu vào cơ sở dữ liệu.
 */
const Category = sequelize.define(
  'Category',
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
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: 'categories',
    timestamps: true,
    hooks: {
      // Sử dụng hook beforeValidate để tự động tạo slug (thuộc tính "slug")
      // từ tên danh mục (thuộc tính "name") trước khi lưu vào cơ sở dữ liệu.
      beforeValidate: (category) => {
        if (category.name) {
          category.slug = slugify(category.name, {
            lower: true,
            strict: true,
          });
        }
      },
    },
  },
);

module.exports = Category;
