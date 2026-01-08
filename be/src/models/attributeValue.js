const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * AttributeValue Model.
 *
 * Thuộc tính "colorCode" có validate để đảm bảo định dạng mã màu hex.
 */
const AttributeValue = sequelize.define(
  'AttributeValue',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    attributeGroupId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'attribute_group_id',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    colorCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'color_code',
      validate: {
        isValidColor(value) {
          if (value && !/^#[0-9A-F]{6}$/i.test(value)) {
            throw new Error('Mã màu phải ở định dạng hex (ví dụ: #FF0000)');
          }
        },
      },
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'image_url',
    },
    priceAdjustment: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'price_adjustment',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    // Thuộc tính affectsName xác định xem giá trị thuộc tính này có ảnh hưởng đến tên sản phẩm hay không
    affectsName: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'affects_name',
    },
    // Thuộc tính nameTemplate lưu trữ mẫu tên sản phẩm liên quan đến giá trị thuộc tính
    nameTemplate: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'name_template',
      comment: 'Template for product name (e.g., "I9", "RTX 4080", "32GB")',
    },
  },
  {
    tableName: 'attribute_values',
    timestamps: true,
  },
);

module.exports = AttributeValue;
