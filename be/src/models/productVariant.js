const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');
const {
  buildPublicImageCollection,
  sanitizeImageCollection,
} = require('../utils/imageUrl');

/**
 * ProductVariant Model.
 *
 * Thuộc tính "attributes" sử dụng JSONB để lưu trữ các thuộc tính động của biến thể sản phẩm.
 *
 * Thuộc tính "attributeValues" mới được thêm vào để lưu trữ các giá trị thuộc tính phân cấp.
 *
 * Thuộc tính "images" sử dụng ARRAY để lưu trữ nhiều URL hình ảnh cho biến thể sản phẩm,
 * khi get sẽ trả về bộ sưu tập hình ảnh công khai,
 * khi set sẽ làm sạch bộ sưu tập hình ảnh trước khi lưu.
 *
 * Thuộc tính "specifications" sử dụng JSONB để lưu trữ các thông số kỹ thuật của biến thể sản phẩm,
 * nó sẽ ghi đè các thông số kỹ thuật của sản phẩm cha nếu có.
 *
 * Sử dụng hook beforeCreate và beforeUpdate để tự động tạo tên hiển thị dựa trên các thuộc tính phân cấp.
 */
const ProductVariant = sequelize.define(
  'ProductVariant',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attributes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    // Trường mới cho các thuộc tính phân cấp
    attributeValues: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'attribute_values',
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Thuộc tính "images" sử dụng ARRAY để lưu trữ nhiều URL hình ảnh cho biến thể sản phẩm
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      // Khi get sẽ trả về bộ sưu tập hình ảnh công khai
      get() {
        return buildPublicImageCollection(this.getDataValue('images'));
      },

      // Khi set sẽ làm sạch bộ sưu tập hình ảnh trước khi lưu
      set(value) {
        const sanitized = sanitizeImageCollection(value);

        this.setDataValue('images', sanitized);
      },
    },
    // Tên hiển thị cho biến thể (được tạo tự động)
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Thứ tự sắp xếp cho các biến thể
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Xác định xem đây có phải là biến thể mặc định không
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Trạng thái khả dụng
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Giá so sánh cho biến thể
    compareAtPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'compare_at_price',
    },
    // Thông số kỹ thuật của biến thể (sẽ ghi đè thông số kỹ thuật của sản phẩm cha nếu có)
    specifications: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: 'product_variants',
    timestamps: true,
    hooks: {
      // Sử dụng hook beforeCreate để tự động tạo tên hiển thị dựa trên các thuộc tính
      beforeCreate: async (variant) => {
        // Tự động tạo tên hiển thị dựa trên các thuộc tính

        // Nếu tên hiển thị chưa được cung cấp và ta được cung cấp các giá trị thuộc tính
        if (!variant.displayName && variant.attributeValues) {
          const productNameService = require('../services/productNameGenerator.service');
          const Product = require('./product');

          try {
            // Tìm sản phẩm cha để lấy tên cơ sở
            const product = await Product.findByPk(variant.productId);

            // Nếu tìm thấy sản phẩm cha và nó có tên cơ sở
            if (product && product.baseName) {
              // Lấy tất cả các ID giá trị thuộc tính
              const attributeValueIds = Object.values(
                variant.attributeValues,
              ).filter((id) => id);

              // Nếu có các ID giá trị thuộc tính, tạo tên hiển thị
              if (attributeValueIds.length > 0) {
                // Tạo tên sản phẩm đầy đủ dựa trên tên cơ sở và các giá trị thuộc tính
                const generatedName =
                  await productNameService.generateProductName(
                    product.baseName,
                    attributeValueIds,
                  );

                // Đặt tên hiển thị bằng cách loại bỏ tên cơ sở khỏi tên đầy đủ
                variant.displayName = generatedName
                  .replace(product.baseName, '')
                  .trim();

                // Đặt tên biến thể thành tên đầy đủ
                variant.name = generatedName;
              }
            }
          } catch (error) {
            console.log('Không thể tự động tạo tên biến thể:', error.message);
          }
        }
      },
      beforeUpdate: async (variant) => {
        // Tự động tạo lại tên hiển thị nếu các thuộc tính thay đổi

        // Nếu các giá trị thuộc tính đã thay đổi
        if (variant.changed('attributeValues') && variant.attributeValues) {
          const productNameService = require('../services/productNameGenerator.service');
          const Product = require('./product');

          try {
            // Tìm sản phẩm cha để lấy tên cơ sở
            const product = await Product.findByPk(variant.productId);

            // Nếu tìm thấy sản phẩm cha và nó có tên cơ sở
            if (product && product.baseName) {
              // Lấy tất cả các ID giá trị thuộc tính
              const attributeValueIds = Object.values(
                variant.attributeValues,
              ).filter((id) => id);

              // Nếu có các ID giá trị thuộc tính, tạo tên hiển thị
              if (attributeValueIds.length > 0) {
                // Tạo tên sản phẩm đầy đủ dựa trên tên cơ sở và các giá trị thuộc tính
                const generatedName =
                  await productNameService.generateProductName(
                    product.baseName,
                    attributeValueIds,
                  );

                // Đặt tên hiển thị bằng cách loại bỏ tên cơ sở khỏi tên đầy đủ
                variant.displayName = generatedName
                  .replace(product.baseName, '')
                  .trim();

                // Đặt tên biến thể thành tên đầy đủ
                variant.name = generatedName;
              }
            }
          } catch (error) {
            console.log(
              'Không thể tự động tạo lại tên biến thể:',
              error.message,
            );
          }
        }
      },
    },
  },
);

module.exports = ProductVariant;
