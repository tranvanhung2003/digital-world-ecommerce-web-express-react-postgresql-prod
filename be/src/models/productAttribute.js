const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * ProductAttribute Model.
 *
 * Thuộc tính "type" sử dụng ENUM("color", "size", "material", "custom")
 * để xác định loại thuộc tính sản phẩm.
 *
 * Thuộc tính "values" sử dụng JSONB
 * để lưu trữ danh sách các giá trị thuộc tính sản phẩm.
 */
const ProductAttribute = sequelize.define(
  'ProductAttribute',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('color', 'size', 'material', 'custom'),
      allowNull: false,
      defaultValue: 'custom',
    },
    values: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
    },
  },
  {
    tableName: 'product_attributes',
    timestamps: true,
  },
);

module.exports = ProductAttribute;
