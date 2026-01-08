const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

/**
 * OrderItem Model.
 *
 * Thuộc tính "attributes" sử dụng JSONB
 * để lưu trữ các thuộc tính tùy chỉnh của sản phẩm trong đơn hàng.
 */
const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    variantId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(19, 2),
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attributes: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: 'order_items',
    timestamps: true,
  },
);

module.exports = OrderItem;
