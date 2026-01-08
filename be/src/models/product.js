const { DataTypes } = require('sequelize');
const slugify = require('slugify');
const sequelize = require('../config/sequelize');
const {
  buildPublicImageCollection,
  buildPublicImageUrl,
  sanitizeImageCollection,
  sanitizeStoredImageValue,
} = require('../utils/imageUrl');

/**
 * Product Model.
 *
 * Thuộc tính "images" là kiểu TEXT, lưu trữ mảng các URL ảnh dưới dạng chuỗi JSON,
 * khi get sẽ chuyển đổi chuỗi JSON thành mảng và xây dựng URL công khai cho từng ảnh,
 * khi set sẽ nhận mảng URL ảnh, làm sạch và lưu trữ dưới dạng chuỗi JSON.
 *
 * Thuộc tính "thumbnail" là kiểu TEXT, lưu trữ URL thumbnail,
 * khi get sẽ xây dựng URL công khai cho thumbnail,
 * khi set sẽ làm sạch URL thumbnail trước khi lưu trữ,
 * chỉ lưu trữ một giá trị duy nhất ngay cả khi đầu vào là mảng.
 *
 * Thuộc tính "status" sử dụng ENUM("active", "inactive", "draft")
 * để giới hạn giá trị trạng thái của sản phẩm.
 *
 * Thuộc tính "searchKeywords" là kiểu TEXT, lưu trữ mảng các từ khóa tìm kiếm dưới dạng chuỗi JSON,
 * khi get sẽ chuyển đổi chuỗi JSON thành mảng,
 * khi set sẽ nhận mảng từ khóa, lưu trữ dưới dạng chuỗi JSON.
 *
 * Thuộc tính "seoKeywords" là kiểu TEXT, lưu trữ mảng các từ khóa SEO dưới dạng chuỗi JSON,
 * khi get sẽ chuyển đổi chuỗi JSON thành mảng,
 * khi set sẽ nhận mảng từ khóa SEO, lưu trữ dưới dạng chuỗi JSON.
 *
 * Thuộc tính "specifications" là kiểu TEXT, lưu trữ mảng các thông số kỹ thuật dưới dạng chuỗi JSON,
 * khi get sẽ chuyển đổi chuỗi JSON thành mảng,
 * khi set sẽ nhận mảng thông số kỹ thuật, lưu trữ dưới dạng chuỗi JSON.
 *
 * Thuộc tính "condition" sử dụng ENUM("new", "like-new", "used", "refurbished")
 * để giới hạn giá trị tình trạng của sản phẩm.
 *
 * Thuộc tính "faqs" là kiểu TEXT, lưu trữ mảng các câu hỏi thường gặp dưới dạng chuỗi JSON,
 * khi get sẽ chuyển đổi chuỗi JSON thành mảng,
 * khi set sẽ nhận mảng câu hỏi thường gặp, lưu trữ dưới dạng chuỗi JSON.
 *
 * Sử dụng hook beforeValidate để tự động tạo slug (thuộc tính "slug")
 * từ tên sản phẩm (thuộc tính "name") trước khi lưu vào cơ sở dữ liệu.
 *
 * Sử dụng hook beforeCreate và beforeUpdate để tự động tạo hoặc cập nhật search keywords
 * khi tạo hoặc cập nhật sản phẩm.
 */
const Product = sequelize.define(
  'Product',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    slug: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    compareAtPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    // Thuộc tính "images" là kiểu TEXT, lưu trữ mảng các URL ảnh dưới dạng chuỗi JSON
    images: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      // Khi get sẽ chuyển đổi chuỗi JSON thành mảng và xây dựng URL công khai cho từng ảnh
      get() {
        return buildPublicImageCollection(this.getDataValue('images'));
      },
      // Khi set sẽ nhận mảng URL ảnh, làm sạch và lưu trữ dưới dạng chuỗi JSON
      set(value) {
        const sanitized = sanitizeImageCollection(value);
        this.setDataValue('images', JSON.stringify(sanitized));
      },
    },
    // Thuộc tính "thumbnail" là kiểu TEXT, lưu trữ URL thumbnail
    thumbnail: {
      type: DataTypes.TEXT,
      allowNull: true,
      // Khi get sẽ xây dựng URL công khai cho thumbnail
      get() {
        return buildPublicImageUrl(this.getDataValue('thumbnail'));
      },
      // Khi set sẽ làm sạch URL thumbnail trước khi lưu trữ,
      // chỉ lưu trữ một giá trị duy nhất ngay cả khi đầu vào là mảng
      set(value) {
        const sanitized = sanitizeStoredImageValue(
          Array.isArray(value) && value.length > 0 ? value[0] : value,
        );
        this.setDataValue('thumbnail', sanitized);
      },
    },
    inStock: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sku: {
      type: DataTypes.TEXT,
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'draft'),
      defaultValue: 'active',
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Thuộc tính "searchKeywords" là kiểu TEXT, lưu trữ mảng các từ khóa tìm kiếm dưới dạng chuỗi JSON
    searchKeywords: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      field: 'search_keywords',
      // Khi get sẽ chuyển đổi chuỗi JSON thành mảng
      get() {
        const value = this.getDataValue('searchKeywords');

        if (!value) return [];

        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      // Khi set sẽ nhận mảng từ khóa, lưu trữ dưới dạng chuỗi JSON
      set(value) {
        this.setDataValue(
          'searchKeywords',
          Array.isArray(value)
            ? JSON.stringify(value)
            : JSON.stringify(value || []),
        );
      },
    },
    seoTitle: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'seo_title',
    },
    seoDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'seo_description',
    },
    // Thuộc tính "seoKeywords" là kiểu TEXT, lưu trữ mảng các từ khóa SEO dưới dạng chuỗi JSON
    seoKeywords: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      field: 'seo_keywords',
      // Khi get sẽ chuyển đổi chuỗi JSON thành mảng
      get() {
        const value = this.getDataValue('seoKeywords');

        if (!value) return [];

        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      // Khi set sẽ nhận mảng từ khóa SEO, lưu trữ dưới dạng chuỗi JSON
      set(value) {
        this.setDataValue(
          'seoKeywords',
          Array.isArray(value)
            ? JSON.stringify(value)
            : JSON.stringify(value || []),
        );
      },
    },
    // Thông số kỹ thuật của laptop/máy tính
    // Thuộc tính "specifications" là kiểu TEXT, lưu trữ mảng các thông số kỹ thuật dưới dạng chuỗi JSON
    specifications: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      field: 'specifications',
      // Khi get sẽ chuyển đổi chuỗi JSON thành mảng
      get() {
        const value = this.getDataValue('specifications');

        if (!value) return [];

        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      // Khi set sẽ nhận mảng thông số kỹ thuật, lưu trữ dưới dạng chuỗi JSON
      set(value) {
        this.setDataValue(
          'specifications',
          typeof value === 'object'
            ? JSON.stringify(value)
            : JSON.stringify(value || []),
        );
      },
    },
    // Tình trạng sản phẩm
    condition: {
      type: DataTypes.ENUM('new', 'like-new', 'used', 'refurbished'),
      defaultValue: 'new',
    },
    // Tên cơ sở cho các sản phẩm có biến thể
    baseName: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'base_name',
    },
    // Sản phẩm này có sử dụng biến thể không
    isVariantProduct: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_variant_product',
    },
    // Các câu hỏi thường gặp về sản phẩm
    // Thuộc tính "faqs" là kiểu TEXT, lưu trữ mảng các câu hỏi thường gặp dưới dạng chuỗi JSON
    faqs: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      field: 'faqs',
      // Khi get sẽ chuyển đổi chuỗi JSON thành mảng
      get() {
        const value = this.getDataValue('faqs');

        if (!value) return [];

        try {
          return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
          return [];
        }
      },
      // Khi set sẽ nhận mảng câu hỏi thường gặp, lưu trữ dưới dạng chuỗi JSON
      set(value) {
        this.setDataValue(
          'faqs',
          typeof value === 'object'
            ? JSON.stringify(value)
            : JSON.stringify(value || []),
        );
      },
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    hooks: {
      // Sử dụng hook beforeValidate để tự động tạo slug (thuộc tính "slug")
      // từ tên sản phẩm (thuộc tính "name") trước khi lưu vào cơ sở dữ liệu.
      beforeValidate: (product) => {
        if (product.name) {
          // Tạo một chuỗi số ngẫu nhiên gồm 6 ký tự số để đảm bảo tính duy nhất của slug
          const randomString = Math.random().toString(36).substring(2, 8);

          const slugName = slugify(product.name, {
            lower: true,
            strict: true,
          });

          // Đặt giá trị slug bằng cách kết hợp tên đã slug với chuỗi số ngẫu nhiên
          product.slug = `${slugName}-${randomString}`;
        }
      },
      // Sử dụng hook beforeCreate và beforeUpdate để tự động tạo hoặc cập nhật search keywords
      // khi tạo hoặc cập nhật sản phẩm
      beforeCreate: async (product) => {
        // Tự động tạo search keywords khi tạo sản phẩm nếu searchKeywords chưa được cung cấp
        if (!product.searchKeywords || product.searchKeywords.length === 0) {
          const keywordGeneratorService = require('../services/keywordGenerator.service');

          product.searchKeywords = keywordGeneratorService.generateKeywords({
            name: product.name,
            shortDescription: product.shortDescription,
            description: product.description,
            category: product.category,
          });
        }
      },
      beforeUpdate: async (product) => {
        // Tự động tạo lại search keywords khi cập nhật sản phẩm nếu có thay đổi
        // ở các trường tên, mô tả ngắn, mô tả dài hoặc danh mục
        if (
          product.changed('name') ||
          product.changed('shortDescription') ||
          product.changed('description') ||
          product.changed('category')
        ) {
          const keywordGeneratorService = require('../services/keywordGenerator.service');

          product.searchKeywords = keywordGeneratorService.generateKeywords({
            name: product.name,
            shortDescription: product.shortDescription,
            description: product.description,
            category: product.category,
          });
        }
      },
    },
  },
);

module.exports = Product;
