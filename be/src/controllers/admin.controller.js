const {
  User,
  Product,
  Order,
  Review,
  Category,
  OrderItem,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  WarrantyPackage,
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');
const { AdminAuditService } = require('../services/adminAuditService');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('../utils/productHelpers');
const { getField, getTableName } = require('../utils/helpers');

/**
 * Thống kê tổng quan
 */
const getDashboardStats = catchAsync(async (req, res) => {
  // Lấy ngày hiện tại
  const today = new Date();

  // Lấy ngày đầu tháng
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Lấy ngày đầu tháng trước
  const startOfLastMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );

  // Lấy ngày cuối tháng trước
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  // Thống kế tổng số người dùng
  const totalUsers = await User.count({ where: { role: 'customer' } });

  // Thống kê tổng số sản phẩm
  const totalProducts = await Product.count();

  // Thống kê tổng số đơn hàng
  const totalOrders = await Order.count();

  // Thống kê tổng doanh thu
  const totalRevenue = await Order.sum('total', {
    where: { status: 'delivered' },
  });

  // Thống kê số người dùng mới trong tháng hiện tại
  const monthlyUsers = await User.count({
    where: {
      role: 'customer',
      createdAt: { [Op.gte]: startOfMonth },
    },
  });

  // Thống kê số đơn hàng trong tháng hiện tại
  const monthlyOrders = await Order.count({
    where: { createdAt: { [Op.gte]: startOfMonth } },
  });

  // Thống kê doanh thu trong tháng hiện tại
  const monthlyRevenue = await Order.sum('total', {
    where: {
      status: 'delivered',
      createdAt: { [Op.gte]: startOfMonth },
    },
  });

  // Thống kê số người dùng mới trong tháng trước
  const lastMonthUsers = await User.count({
    where: {
      role: 'customer',
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  // Thống kê số đơn hàng trong tháng trước
  const lastMonthOrders = await Order.count({
    where: {
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  // Thống kê doanh thu trong tháng trước
  const lastMonthRevenue = await Order.sum('total', {
    where: {
      status: 'delivered',
      createdAt: {
        [Op.gte]: startOfLastMonth,
        [Op.lte]: endOfLastMonth,
      },
    },
  });

  // Thống kê tốc độ tăng tưởng về số người dùng mới so với tháng trước
  const userGrowth = lastMonthUsers
    ? ((monthlyUsers - lastMonthUsers) / lastMonthUsers) * 100
    : 0;

  // Thống kê tốc độ tăng trưởng về số đơn đơn hàng so với tháng trước
  const orderGrowth = lastMonthOrders
    ? ((monthlyOrders - lastMonthOrders) / lastMonthOrders) * 100
    : 0;

  // Thống kê tốc độ tăng trưởng về doanh thu so với tháng trước
  const revenueGrowth = lastMonthRevenue
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  const OrderItem_quantity = getField(OrderItem, 'quantity');
  const OrderItem_price = getField(OrderItem, 'price');

  // Thống kê top 5 sản phẩm bán chạy nhất
  const topProducts = await OrderItem.findAll({
    attributes: [
      'productId',
      [Sequelize.fn('SUM', Sequelize.col(OrderItem_quantity)), 'totalSold'],
      [
        Sequelize.fn(
          'SUM',
          Sequelize.literal(
            `"${OrderItem_quantity}" * "OrderItem"."${OrderItem_price}"`,
          ),
        ),
        'totalRevenue',
      ],
    ],
    include: [
      {
        model: Product,
        attributes: ['name', 'images', 'price'],
      },
    ],
    group: ['productId', 'Product.id'],
    order: [[Sequelize.fn('SUM', Sequelize.col(OrderItem_quantity)), 'DESC']],
    limit: 5,
  });

  // Thống kê số đơn hàng đang chờ xử lý
  const pendingOrders = await Order.count({
    where: { status: 'pending' },
  });

  // Thống kê số đơn hàng đang xử lý
  const processingOrders = await Order.count({
    where: { status: 'processing' },
  });

  res.status(200).json({
    status: 'success',
    data: {
      overview: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue || 0,
        pendingOrders,
        processingOrders,
      },
      monthly: {
        users: monthlyUsers,
        orders: monthlyOrders,
        revenue: monthlyRevenue || 0,
      },
      growth: {
        users: parseFloat(userGrowth.toFixed(2)),
        orders: parseFloat(orderGrowth.toFixed(2)),
        revenue: parseFloat(revenueGrowth.toFixed(2)),
      },
      topProducts: topProducts.map((item) => ({
        product: item.Product,
        totalSold: parseInt(item.getDataValue('totalSold')),
        totalRevenue: parseFloat(item.getDataValue('totalRevenue')),
      })),
    },
  });
});

/**
 * Thống kê chi tiết theo khoảng thời gian
 */
const getDetailedStats = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = 'day' } = req.query;

  // Kiểm tra startDate và endDate bắt buộc phải có
  if (!startDate || !endDate) {
    throw new AppError('Vui lòng cung cấp ngày bắt đầu và ngày kết thúc', 400);
  }

  // Chuyển đổi chuỗi ngày thành đối tượng Date
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Xác định định dạng ngày tháng dựa trên groupBy
  let dateFormat;
  switch (groupBy) {
    case 'hour':
      dateFormat = 'YYYY-MM-DD HH24:00:00';
      break;
    case 'day':
      dateFormat = 'YYYY-MM-DD';
      break;
    case 'week':
      dateFormat = 'IYYY-IW'; // ISO week
      break;
    case 'month':
      dateFormat = 'YYYY-MM';
      break;
    default:
      dateFormat = 'YYYY-MM-DD';
  }

  const Order_createdAt = getField(Order, 'createdAt');
  const Order_total = getField(Order, 'total');

  // Thống kê đơn hàng theo khoảng thời gian (từ startDate đến endDate)
  const orderStats = await Order.findAll({
    attributes: [
      [
        Sequelize.fn('TO_CHAR', Sequelize.col(Order_createdAt), dateFormat),
        'period',
      ],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCount'],
      [Sequelize.fn('SUM', Sequelize.col(Order_total)), 'revenue'],
    ],
    where: {
      createdAt: {
        [Op.between]: [start, end],
      },
    },
    group: [
      Sequelize.fn('TO_CHAR', Sequelize.col(Order_createdAt), dateFormat),
    ],
    order: [
      [
        Sequelize.fn('TO_CHAR', Sequelize.col(Order_createdAt), dateFormat),
        'ASC',
      ],
    ],
  });

  const User_createdAt = getField(User, 'createdAt');

  // Thống kê user mới theo khoảng thời gian (từ startDate đến endDate)
  const userStats = await User.findAll({
    attributes: [
      [
        Sequelize.fn('TO_CHAR', Sequelize.col(User_createdAt), dateFormat),
        'period',
      ],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newUsers'],
    ],
    where: {
      role: 'customer',
      createdAt: {
        [Op.between]: [start, end],
      },
    },
    group: [Sequelize.fn('TO_CHAR', Sequelize.col(User_createdAt), dateFormat)],
    order: [
      [
        Sequelize.fn('TO_CHAR', Sequelize.col(User_createdAt), dateFormat),
        'ASC',
      ],
    ],
  });

  res.status(200).json({
    status: 'success',
    data: {
      orders: orderStats.map((stat) => ({
        period: stat.getDataValue('period'),
        orderCount: parseInt(stat.getDataValue('orderCount')),
        revenue: parseFloat(stat.getDataValue('revenue') || 0),
      })),
      users: userStats.map((stat) => ({
        period: stat.getDataValue('period'),
        newUsers: parseInt(stat.getDataValue('newUsers')),
      })),
    },
  });
});

/**
 * Quản lý Users - Lấy danh sách user
 */
const getAllUsers = catchAsync(async (req, res) => {
  // Lấy các tham số lọc và phân trang từ query
  const {
    page = 1,
    limit = 10,
    search = '',
    role = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    isEmailVerified,
  } = req.query;

  // Tính toán offset cho phân trang
  const offset = (page - 1) * limit;

  // Xây dựng điều kiện lọc
  const whereClause = {};

  // Tìm kiếm theo tên, email hoặc số điện thoại
  if (search) {
    whereClause[Op.or] = [
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter theo role
  if (role) {
    whereClause.role = role;
  }

  // Filter theo isEmailVerified
  if (isEmailVerified !== undefined) {
    whereClause.isEmailVerified = isEmailVerified === 'true';
  }

  // Truy vấn database với phân trang và lọc
  const { count, rows: users } = await User.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    attributes: {
      exclude: ['password', 'verificationToken', 'resetPasswordToken'],
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Quản lý Users - Cập nhật thông tin user
 */
const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, role, isEmailVerified, isActive } =
    req.body;

  // Kiểm tra sự tồn tại của user
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  // Không cho phép user tự update role của chính mình
  if (req.user.id === id && role && role !== user.role) {
    throw new AppError('Không thể thay đổi role của chính mình', 403);
  }

  // Không cho phép user tự deactivate tài khoản của chính mình
  if (req.user.id === id && isActive === false) {
    throw new AppError('Không thể vô hiệu hóa tài khoản của chính mình', 403);
  }

  // Cập nhật thông tin user
  const updatedUser = await user.update({
    firstName: firstName || user.firstName,
    lastName: lastName || user.lastName,
    phone: phone || user.phone,
    role: role || user.role,
    isEmailVerified:
      isEmailVerified !== undefined ? isEmailVerified : user.isEmailVerified,
    isActive: isActive !== undefined ? isActive : user.isActive,
  });

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser },
  });
});

/**
 * Quản lý Users - Xóa user
 */
const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Không cho phép xóa chính mình
  if (req.user.id === id) {
    throw new AppError('Không thể xóa tài khoản của chính mình', 403);
  }

  // Kiểm tra sự tồn tại của user
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404);
  }

  // Xóa user
  await user.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa người dùng thành công',
  });
});

/**
 * Quản lý Products - Lấy chi tiết sản phẩm
 */
const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Tìm sản phẩm theo ID kèm các quan hệ liên quan
  const product = await Product.findByPk(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'attributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
        where: { isActive: true },
        required: false,
      },
    ],
  });

  // Kiểm tra sự tồn tại của sản phẩm
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { product },
  });
});

/**
 * Quản lý Products - Tạo sản phẩm mới
 */
const createProduct = catchAsync(async (req, res) => {
  console.log(
    'Create product từ request body:',
    JSON.stringify(req.body, null, 2),
  );

  // Lấy dữ liệu từ request body
  const {
    name,
    baseName,
    description,
    shortDescription,
    price,
    comparePrice,
    stock,
    sku,
    status = 'active',
    images,
    thumbnail,
    inStock = true,
    stockQuantity = 0,
    featured = false,
    searchKeywords = [],
    seoTitle,
    seoDescription,
    seoKeywords = [],
    categoryIds = [],
    attributes = [],
    variants = [],
    // Các trường mới cho laptop/máy tính
    condition = 'new',
    specifications = {},
    warrantyPackageIds = [],
    faqs = [],
  } = req.body;

  // Tạo SKU duy nhất nếu không được cung cấp
  const uniqueSku =
    sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Kiểm tra xem SKU đã tồn tại chưa nếu người dùng cung cấp SKU
  if (sku) {
    const existingProduct = await Product.findOne({ where: { sku } });
    if (existingProduct) {
      return res.status(400).json({
        status: 'fail',
        message: `Mã SKU '${sku}' đã tồn tại. Vui lòng sử dụng mã SKU khác.`,
        errors: [
          {
            field: 'sku',
            message: `Mã SKU '${sku}' đã tồn tại. Vui lòng sử dụng mã SKU khác.`,
          },
        ],
      });
    }
  }

  // Tạo sản phẩm mới
  const product = await Product.create({
    name,
    baseName: baseName || name,
    description,
    shortDescription: shortDescription || description,
    price,
    // Tạm thời bỏ qua compareAtPrice, sẽ cập nhật ở dưới
    compareAtPrice: null,
    images: images || [],
    thumbnail: images && images[0] ? images[0] : thumbnail,
    inStock: status === 'active',
    stockQuantity: stock || stockQuantity || 0,
    sku: uniqueSku,
    status,
    featured,
    searchKeywords: searchKeywords || [],
    seoTitle: seoTitle || name,
    seoDescription: seoDescription || description,
    seoKeywords: seoKeywords || [],
    // Các trường mới cho laptop/máy tính
    condition,
    specifications: specifications || [],
    faqs: faqs || [],
  });

  // Cập nhật compareAtPrice riêng bằng truy vấn SQL trực tiếp
  console.log('comparePrice từ request body:', comparePrice);
  if (comparePrice !== undefined) {
    const { sequelize } = require('../models');

    const productTableName = getTableName(Product);
    const Product_compareAtPrice = getField(Product, 'compareAtPrice');

    await sequelize.query(
      `UPDATE ${productTableName} SET ${Product_compareAtPrice} = :comparePrice WHERE id = :id`,
      {
        replacements: {
          comparePrice: comparePrice,
          id: product.id,
        },
        type: sequelize.QueryTypes.UPDATE,
      },
    );

    // Cập nhật lại giá trị compareAtPrice trong đối tượng product
    product.compareAtPrice = comparePrice;
  }

  // Thêm categories nếu có
  if (categoryIds && categoryIds.length > 0) {
    try {
      // Kiểm tra xem có cần tạo danh mục không (cho mục đích demo/development)
      // Trong quá trình production, ta thường chọn danh mục dựa trên các danh mục hiện có
      const { Category } = require('../models');

      // Đối với mỗi ID danh mục, tìm nó hoặc tạo một placeholder
      const categoryPromises = categoryIds.map(async (catId) => {
        // Thử tìm danh mục trước
        let category = await Category.findByPk(catId).catch(() => null);

        // Nếu danh mục không tồn tại và ID là một số đơn giản (từ mock data)
        if (!category && /^\d+$/.test(catId)) {
          // Tạo một danh mục placeholder với ID này như một phần của tên
          // Chỉ dành cho mục đích development/demo
          category = await Category.create({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Danh mục được tạo tự động từ ID ${catId}`,
            isActive: true,
          });
        }

        return category ? category.id : null;
      });

      // Lọc ra các ID danh mục hợp lệ
      const validCategoryIds = (await Promise.all(categoryPromises)).filter(
        (id) => id !== null,
      );

      // Liên kết sản phẩm với các danh mục hợp lệ
      if (validCategoryIds.length > 0) {
        await product.setCategories(validCategoryIds);
      }
    } catch (error) {
      console.error('Lỗi khi xử lý danh mục:', error);
      // Tiếp tục mà không có danh mục nếu có lỗi
    }
  }

  // Xử lý attributes
  if (attributes && attributes.length > 0) {
    try {
      console.log('Đang xử lý attributes:', attributes);

      const attributePromises = attributes.map(async (attr) => {
        let attrValues = [];

        // Xử lý giá trị thuộc tính: nếu là chuỗi có dấu phẩy, tách thành mảng
        if (typeof attr.value === 'string') {
          // Tách chuỗi thành mảng dựa trên dấu phẩy và loại bỏ khoảng trắng
          attrValues = attr.value
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v);
        } else if (Array.isArray(attr.value)) {
          // Nếu là mảng, sử dụng trực tiếp
          attrValues = attr.value;
        } else if (attr.value) {
          // Nếu không phải chuỗi hoặc mảng nhưng có giá trị
          attrValues = [String(attr.value)];
        }

        console.log(
          `Đang tạo attribute: ${attr.name} với các giá trị:`,
          attrValues,
        );

        return await ProductAttribute.create({
          productId: product.id,
          name: attr.name,
          values: attrValues.length > 0 ? attrValues : ['Default'],
        });
      });

      await Promise.all(attributePromises);
    } catch (error) {
      console.error('Lỗi khi tạo thuộc tính:', error);
      throw error; // Phải ném lỗi vì thuộc tính là bắt buộc
    }
  }

  // Xử lý variants
  let createdVariants = [];

  if (variants && variants.length > 0) {
    try {
      console.log('Đang xử lý variants:', variants);

      // Lấy attributes để validate
      const productAttributes = await ProductAttribute.findAll({
        where: { productId: product.id },
      });

      const variantPromises = variants.map(async (variant) => {
        // Đảm bảo variant.attributes luôn là một object
        const variantAttributes = variant.attributes || {};

        console.log(`Đang xử lý variant: ${variant.name}`, {
          price: variant.price,
          stock: variant.stock,
          sku: variant.sku,
          attributes: variantAttributes,
        });

        // Validate variant attributes - bỏ qua validation nếu không có thuộc tính
        if (
          productAttributes.length > 0 &&
          Object.keys(variantAttributes).length > 0
        ) {
          try {
            // Bỏ qua validation để đảm bảo biến thể được tạo
            // const isValid = validateVariantAttributes(
            //   productAttributes,
            //   variantAttributes
            // );
            // if (!isValid) {
            //   throw new Error(
            //     `Thuộc tính biến thể không hợp lệ cho biến thể: ${variant.name}`
            //   );
            // }
          } catch (error) {
            console.error('Lỗi khi xác thực thuộc tính biến thể:', error);
            // Không throw error, chỉ log để tiếp tục tạo biến thể
          }
        }

        // Tạo SKU cho biến thể nếu không được cung cấp
        const variantSku =
          variant.sku || generateVariantSku(uniqueSku, variantAttributes);

        console.log(`Đang tạo biến thể với SKU: ${variantSku}`);

        // Tạo tên hiển thị cho biến thể
        const displayName =
          variant.displayName ||
          Object.values(variantAttributes).join(' - ') ||
          variant.name;

        // Tạo biến thể với dữ liệu đã được xác thực
        return await ProductVariant.create({
          productId: product.id,
          name: variant.name,
          sku: variantSku,
          attributes: variantAttributes,
          price: parseFloat(variant.price) || 0,
          stockQuantity: parseInt(variant.stock) || 0,
          images: variant.images || [],
          displayName,
          sortOrder: variant.sortOrder || 0,
          isDefault: variant.isDefault || false,
          isAvailable: variant.isAvailable !== false,
        });
      });

      createdVariants = await Promise.all(variantPromises);

      // Tính tổng tồn kho từ các biến thể
      const totalStock = calculateTotalStock(createdVariants);

      // Cập nhật lại tổng tồn kho của sản phẩm từ các biến thể
      await Product.update(
        {
          stockQuantity: totalStock,
          inStock: totalStock > 0,
        },
        { where: { id: product.id } },
      );
    } catch (error) {
      console.error('Lỗi khi tạo biến thể:', error);
      throw error; // Phải ném lỗi vì biến thể là bắt buộc
    }
  }

  // Thêm specifications nếu có
  if (
    specifications &&
    Array.isArray(specifications) &&
    specifications.length > 0
  ) {
    try {
      const { ProductSpecification } = require('../models');

      const specificationData = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: spec.sortOrder || index,
      }));

      await ProductSpecification.bulkCreate(specificationData);

      console.log(
        `Đã tạo ${specifications.length} specifications cho sản phẩm ${product.id}`,
      );
    } catch (error) {
      console.error('Lỗi khi tạo specifications:', error);
      // Không throw error để không làm fail toàn bộ quá trình tạo product
    }
  }

  // Xử lý warranty packages
  if (
    warrantyPackageIds &&
    Array.isArray(warrantyPackageIds) &&
    warrantyPackageIds.length > 0
  ) {
    try {
      const { ProductWarranty, WarrantyPackage } = require('../models');

      // Kiểm tra xem các warranty packages có tồn tại không
      console.log(
        'Đang tìm kiếm các gói bảo hành với IDs:',
        warrantyPackageIds,
      );

      const existingWarrantyPackages = await WarrantyPackage.findAll({
        where: { id: warrantyPackageIds, isActive: true },
      });

      console.log(
        'Đã tìm thấy các gói bảo hành:',
        existingWarrantyPackages.length,
      );

      if (existingWarrantyPackages.length > 0) {
        const warrantyPromises = existingWarrantyPackages.map(
          async (warrantyPackage, index) => {
            return await ProductWarranty.create({
              productId: product.id,
              warrantyPackageId: warrantyPackage.id,
              isDefault: index === 0, // Đặt warranty package đầu tiên làm mặc định
            });
          },
        );

        await Promise.all(warrantyPromises);

        console.log(
          `Đã tạo ${existingWarrantyPackages.length} gói bảo hành liên kết với sản phẩm ${product.id}`,
        );
      }
    } catch (error) {
      console.error('Lỗi khi tạo gói bảo hành:', error);
      // Tiếp tục mà không làm fail toàn bộ quá trình tạo sản phẩm
    }
  }

  // Lấy lại product với attributes và variants
  const productWithRelations = await Product.findByPk(product.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'attributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
        where: { isActive: true },
        required: false,
      },
    ],
  });

  // Log audit
  console.log('req.user trong createProduct:', req.user); // Debug log
  AdminAuditService.logProductAction(
    req.user,
    'CREATE',
    product.id,
    product.name,
  );

  res.status(201).json({
    status: 'success',
    data: { product: productWithRelations },
  });
});

/**
 * Quản lý Products - Cập nhật sản phẩm
 */
const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    shortDescription,
    price,
    compareAtPrice,
    comparePrice, // Thêm comparePrice để hỗ trợ cả hai tên tham số
    images,
    thumbnail,
    inStock,
    stockQuantity,
    sku,
    status,
    featured,
    searchKeywords,
    seoTitle,
    seoDescription,
    seoKeywords,
    categoryIds,
    attributes = [],
    variants = [],
    specifications = [],
    warrantyPackageIds = [],
    faqs = [],
  } = req.body;

  // Debug logs để kiểm tra dữ liệu nhận được
  // console.log('updateProduct - Request body keys:', Object.keys(req.body));
  // console.log('updateProduct - specifications:', specifications);
  // console.log('updateProduct - specifications type:', typeof specifications);
  // console.log(
  //   'updateProduct - specifications isArray:',
  //   Array.isArray(specifications),
  // );
  // console.log(
  //   'updateProduct - hasOwnProperty specifications:',
  //   req.body.hasOwnProperty('specifications'),
  // );
  // console.log('updateProduct - warrantyPackageIds:', warrantyPackageIds);
  // console.log(
  //   'updateProduct - hasOwnProperty warrantyPackageIds:',
  //   req.body.hasOwnProperty('warrantyPackageIds'),
  // );

  const product = await Product.findByPk(id);

  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Theo dõi các thay đổi để ghi log
  const changes = {};

  if (name && name !== product.name)
    changes.name = { from: product.name, to: name };
  if (price && price !== product.price)
    changes.price = { from: product.price, to: price };
  if (inStock !== undefined && inStock !== product.inStock)
    changes.inStock = { from: product.inStock, to: inStock };
  if (stockQuantity !== undefined && stockQuantity !== product.stockQuantity)
    changes.stockQuantity = { from: product.stockQuantity, to: stockQuantity };
  if (sku && sku !== product.sku) changes.sku = { from: product.sku, to: sku };
  if (status && status !== product.status)
    changes.status = { from: product.status, to: status };

  // Cập nhật sản phẩm - chỉ cập nhật các trường có trong request
  const updateData = {};

  // Chỉ cập nhật các trường có trong request body
  if (req.body.hasOwnProperty('name')) updateData.name = name;
  if (req.body.hasOwnProperty('description'))
    updateData.description = description;
  if (req.body.hasOwnProperty('shortDescription'))
    updateData.shortDescription = shortDescription;
  if (req.body.hasOwnProperty('price')) updateData.price = price;
  if (req.body.hasOwnProperty('images')) updateData.images = images;
  if (req.body.hasOwnProperty('thumbnail')) updateData.thumbnail = thumbnail;
  if (req.body.hasOwnProperty('inStock')) updateData.inStock = inStock;
  if (req.body.hasOwnProperty('stockQuantity'))
    updateData.stockQuantity = stockQuantity;
  if (req.body.hasOwnProperty('sku')) updateData.sku = sku;
  if (req.body.hasOwnProperty('status')) updateData.status = status;
  if (req.body.hasOwnProperty('featured')) updateData.featured = featured;
  if (req.body.hasOwnProperty('searchKeywords')) {
    console.log('Updating searchKeywords:', searchKeywords);
    updateData.searchKeywords = searchKeywords;
  }
  if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
  if (req.body.hasOwnProperty('seoDescription'))
    updateData.seoDescription = seoDescription;
  if (req.body.hasOwnProperty('seoKeywords'))
    updateData.seoKeywords = seoKeywords;
  if (req.body.hasOwnProperty('faqs')) updateData.faqs = faqs;

  // Cập nhật sản phẩm với dữ liệu mới
  console.log('UpdateData trước khi update:', updateData);

  // Thực hiện cập nhật sản phẩm
  const updatedProduct = await product.update(updateData);

  // Cập nhật compareAtPrice riêng bằng truy vấn SQL trực tiếp nếu có trong request
  // Hỗ trợ cả compareAtPrice và comparePrice
  if (
    req.body.hasOwnProperty('compareAtPrice') ||
    req.body.hasOwnProperty('comparePrice')
  ) {
    const { sequelize } = require('../models');
    // Ưu tiên sử dụng compareAtPrice, nếu không có thì dùng comparePrice
    const priceToCompare = req.body.hasOwnProperty('compareAtPrice')
      ? compareAtPrice
      : comparePrice;

    const productTableName = getTableName(Product);
    const Product_compareAtPrice = getField(Product, 'compareAtPrice');

    // Thực hiện cập nhật trực tiếp trong database
    await sequelize.query(
      `UPDATE ${productTableName} SET ${Product_compareAtPrice} = :compareAtPrice WHERE id = :id`,
      {
        replacements: {
          compareAtPrice: priceToCompare,
          id: product.id,
        },
        type: sequelize.QueryTypes.UPDATE,
      },
    );

    // Cập nhật lại giá trị trong đối tượng product để trả về cho client
    updatedProduct.compareAtPrice = priceToCompare;

    // Log thông tin để debug
    console.log(
      `Đã cập nhật compareAtPrice là ${priceToCompare} cho sản phẩm ${product.id}`,
    );
  }

  // Cập nhật categories nếu có
  if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
    try {
      // Kiểm tra xem có cần tạo danh mục không (cho mục đích demo/development)
      // Trong quá trình production, ta thường chọn danh mục dựa trên các danh mục hiện có
      const { Category } = require('../models');

      // Đối với mỗi ID danh mục, tìm nó hoặc tạo một placeholder
      const categoryPromises = categoryIds.map(async (catId) => {
        // Thử tìm danh mục trước
        let category = await Category.findByPk(catId).catch(() => null);

        // Nếu danh mục không tồn tại và ID là một số đơn giản (từ mock data)
        if (!category && /^\d+$/.test(catId)) {
          // Tạo một danh mục placeholder với ID này như một phần của tên
          // Điều này chỉ dành cho mục đích phát triển/demo
          category = await Category.create({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Danh mục được tạo tự động từ ID ${catId}`,
            isActive: true,
          });
        }

        return category ? category.id : null;
      });

      // Lọc ra các ID danh mục hợp lệ
      const validCategoryIds = (await Promise.all(categoryPromises)).filter(
        (id) => id !== null,
      );

      // Liên kết sản phẩm với các danh mục hợp lệ
      if (validCategoryIds.length > 0) {
        await product.setCategories(validCategoryIds);
        changes.categories = validCategoryIds;
      }
    } catch (error) {
      console.error('Error handling categories:', error);
      // Tiếp tục mà không có danh mục nếu có lỗi
    }
  }

  // Xử lý attributes - chỉ khi request có chứa field 'attributes'
  if (req.body.hasOwnProperty('attributes') && Array.isArray(attributes)) {
    try {
      console.log('Đang cập nhật attributes:', attributes);

      // Xóa tất cả attributes cũ
      await ProductAttribute.destroy({ where: { productId: id } });

      // Tạo attributes mới
      if (attributes.length > 0) {
        const attributePromises = attributes.map(async (attr) => {
          // Xử lý giá trị thuộc tính: nếu là chuỗi có dấu phẩy, tách thành mảng
          let attrValues = [];
          if (typeof attr.value === 'string') {
            // Tách chuỗi thành mảng dựa trên dấu phẩy và loại bỏ khoảng trắng
            attrValues = attr.value
              .split(',')
              .map((v) => v.trim())
              .filter((v) => v);
          } else if (Array.isArray(attr.value)) {
            // Nếu là mảng, sử dụng trực tiếp
            attrValues = attr.value;
          } else if (attr.value) {
            // Nếu không phải chuỗi hoặc mảng nhưng có giá trị
            attrValues = [String(attr.value)];
          }

          console.log(
            `Đang tạo attribute: ${attr.name} với các giá trị:`,
            attrValues,
          );

          return await ProductAttribute.create({
            productId: id,
            name: attr.name,
            values: attrValues.length > 0 ? attrValues : ['Default'],
          });
        });
        await Promise.all(attributePromises);
        changes.attributes = attributes.length;
      }
    } catch (error) {
      console.error('Error updating attributes:', error);
      throw error; // Ném lỗi để transaction có thể rollback
    }
  }

  // Xử lý variants - chỉ khi request có chứa field 'variants'
  if (req.body.hasOwnProperty('variants') && Array.isArray(variants)) {
    try {
      // Xóa tất cả variants cũ
      await ProductVariant.destroy({ where: { productId: id } });

      // Tạo variants mới
      let createdVariants = [];
      if (variants.length > 0) {
        // Lấy attributes để validate
        const productAttributes = await ProductAttribute.findAll({
          where: { productId: id },
        });

        const variantPromises = variants.map(async (variant) => {
          // Đảm bảo variant.attributes luôn là một object
          const variantAttributes = variant.attributes || {};

          console.log(`Đang xử lý variant: ${variant.name}`, {
            price: variant.price,
            stock: variant.stock,
            sku: variant.sku,
            attributes: variantAttributes,
          });

          // Validate variant attributes - bỏ qua validation nếu không có thuộc tính
          if (
            productAttributes.length > 0 &&
            Object.keys(variantAttributes).length > 0
          ) {
            try {
              // Tạm thời bỏ qua validation để đảm bảo biến thể được tạo
              // const isValid = validateVariantAttributes(
              //   productAttributes,
              //   variantAttributes
              // );
              // if (!isValid) {
              //   throw new Error(
              //     `Thuộc tính biến thể không hợp lệ cho biến thể: ${variant.name}`
              //   );
              // }
            } catch (error) {
              console.error('Lỗi khi xác thực thuộc tính biến thể:', error);
              // Không throw error, chỉ log để tiếp tục tạo biến thể
            }
          }

          // Tạo SKU cho biến thể nếu không được cung cấp
          const variantSku =
            variant.sku ||
            generateVariantSku(updatedProduct.sku, variantAttributes);

          console.log(`Đang tạo biến thể với SKU: ${variantSku}`);

          return await ProductVariant.create({
            productId: id,
            name: variant.name,
            sku: variantSku,
            attributes: variantAttributes,
            price: parseFloat(variant.price) || 0,
            stockQuantity: parseInt(variant.stock) || 0,
            images: variant.images || [],
          });
        });

        createdVariants = await Promise.all(variantPromises);
        changes.variants = variants.length;

        // Cập nhật lại tổng tồn kho của sản phẩm từ các biến thể
        const totalStock = calculateTotalStock(createdVariants);
        await Product.update(
          {
            stockQuantity: totalStock,
            inStock: totalStock > 0,
          },
          { where: { id } },
        );
      } else {
        // Chỉ cập nhật nếu stockQuantity đã được gửi trong request
        if (req.body.hasOwnProperty('stockQuantity')) {
          await Product.update(
            {
              stockQuantity: stockQuantity,
              inStock: stockQuantity > 0,
            },
            { where: { id } },
          );
        }
      }
    } catch (error) {
      console.error('Error updating variants:', error);
      throw error;
    }
  }

  // Xử lý specifications - chỉ khi request có chứa field 'specifications'
  if (
    req.body.hasOwnProperty('specifications') &&
    Array.isArray(specifications)
  ) {
    try {
      console.log('Đang cập nhật specifications:', specifications);
      const { ProductSpecification } = require('../models');

      // Xóa tất cả specifications cũ
      await ProductSpecification.destroy({ where: { productId: id } });

      // Tạo specifications mới
      if (specifications.length > 0) {
        const specificationData = specifications.map((spec, index) => ({
          productId: id,
          name: spec.name,
          value: spec.value,
          category: spec.category || 'General',
          sortOrder: spec.sortOrder || index,
        }));

        await ProductSpecification.bulkCreate(specificationData);
        console.log(
          `Đã cập nhật ${specifications.length} specifications cho sản phẩm ${id}`,
        );
        changes.specifications = specifications.length;
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật specifications:', error);
      throw error;
    }
  }

  // Xử lý warranty packages - chỉ khi request có chứa field 'warrantyPackageIds'
  if (
    req.body.hasOwnProperty('warrantyPackageIds') &&
    Array.isArray(warrantyPackageIds)
  ) {
    try {
      console.log('Đang cập nhật gói bảo hành:', warrantyPackageIds);
      const { ProductWarranty, WarrantyPackage } = require('../models');

      // Xóa tất cả gói bảo hành cũ
      await ProductWarranty.destroy({ where: { productId: id } });

      // Tạo gói bảo hành mới
      if (warrantyPackageIds.length > 0) {
        // Kiểm tra xem các gói bảo hành có tồn tại không
        console.log(
          'Đang tìm kiếm các gói bảo hành với IDs:',
          warrantyPackageIds,
        );
        const existingWarrantyPackages = await WarrantyPackage.findAll({
          where: { id: warrantyPackageIds, isActive: true },
        });
        console.log(
          'Đã tìm thấy các gói bảo hành:',
          existingWarrantyPackages.length,
        );

        if (existingWarrantyPackages.length > 0) {
          const warrantyPromises = existingWarrantyPackages.map(
            async (warrantyPackage, index) => {
              return await ProductWarranty.create({
                productId: id,
                warrantyPackageId: warrantyPackage.id,
                isDefault: index === 0, // Đặt warranty package đầu tiên làm mặc định
              });
            },
          );

          await Promise.all(warrantyPromises);
          console.log(
            `Đã tạo ${existingWarrantyPackages.length} gói bảo hành liên kết với sản phẩm ${id}`,
          );
        }
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật gói bảo hành:', error);
      // Tiếp tục mà không làm fail toàn bộ quá trình cập nhật sản phẩm
    }
  }

  // Lấy lại product với attributes, variants và specifications
  const productWithRelations = await Product.findByPk(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'attributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: WarrantyPackage,
        as: 'warrantyPackages',
        through: {
          attributes: ['isDefault'],
          as: 'productWarranty',
        },
        where: { isActive: true },
        required: false,
      },
    ],
  });

  // Log audit
  AdminAuditService.logProductAction(
    req.user,
    'UPDATE',
    product.id,
    product.name,
    changes,
  );

  res.status(200).json({
    status: 'success',
    data: { product: productWithRelations },
  });
});

/**
 * Quản lý Products - Xóa sản phẩm
 */
const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Tải các model cần thiết
  const {
    CartItem,
    OrderItem,
    Wishlist,
    ProductAttribute,
    ProductVariant,
    ProductCategory,
    sequelize,
  } = require('../models');

  // Kiểm tra sự tồn tại của sản phẩm
  const product = await Product.findByPk(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
  const transaction = await sequelize.transaction();

  try {
    // Xóa các bản ghi liên quan trong CartItem
    await CartItem.destroy({ where: { productId: id }, transaction });

    // Xóa các bản ghi liên quan trong OrderItem (hoặc có thể giữ lại lịch sử đơn hàng)
    // await OrderItem.destroy({ where: { productId: id }, transaction });

    // Xóa các bản ghi liên quan trong Wishlist
    await Wishlist.destroy({ where: { productId: id }, transaction });

    // Xóa các thuộc tính của sản phẩm
    await ProductAttribute.destroy({ where: { productId: id }, transaction });

    // Xóa các biến thể của sản phẩm
    await ProductVariant.destroy({ where: { productId: id }, transaction });

    // Xóa các liên kết danh mục
    await ProductCategory.destroy({ where: { productId: id }, transaction });

    // Cuối cùng xóa sản phẩm
    await product.destroy({ transaction });

    // Commit transaction nếu tất cả thành công
    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Xóa sản phẩm thành công',
    });
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await transaction.rollback();
    throw error;
  }
});

/**
 * Quản lý Products - Lấy danh sách sản phẩm với filter admin
 */
const getAllProducts = catchAsync(async (req, res) => {
  // Lấy các tham số filter từ query
  const {
    page = 1,
    limit = 10,
    search = '',
    category = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    priceMin,
    priceMax,
    stockMin,
    stockMax,
  } = req.query;

  // Tính toán offset cho phân trang
  const offset = (page - 1) * limit;

  // Xây dựng where clause động dựa trên các tham số filter
  const whereClause = {};

  // Filter theo tìm kiếm
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { shortDescription: { [Op.like]: `%${search}%` } },
      { sku: { [Op.like]: `%${search}%` } },
    ];
  }

  // Filter theo status
  if (status) {
    whereClause.status = status;
  }

  // Filter theo giá
  if (priceMin) {
    whereClause.price = {
      ...whereClause.price,
      [Op.gte]: parseFloat(priceMin),
    };
  }
  if (priceMax) {
    whereClause.price = {
      ...whereClause.price,
      [Op.lte]: parseFloat(priceMax),
    };
  }

  // Filter theo stock
  if (stockMin) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.gte]: parseInt(stockMin),
    };
  }
  if (stockMax) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.lte]: parseInt(stockMax),
    };
  }

  const includeClause = [
    {
      model: Category,
      as: 'categories',
      through: { attributes: [] },
    },
    {
      model: ProductVariant,
      as: 'variants',
      required: false,
    },
    {
      model: ProductAttribute,
      as: 'attributes',
      required: false,
    },
    {
      model: ProductSpecification,
      as: 'productSpecifications',
      required: false,
    },
    {
      model: WarrantyPackage,
      as: 'warrantyPackages',
      through: { attributes: [] },
      required: false,
    },
  ];

  // Filter theo category
  if (category) {
    includeClause[0].where = { id: category };
  }

  // Thực hiện truy vấn với phân trang và sắp xếp
  const { count, rows: products } = await Product.findAndCountAll({
    where: whereClause,
    include: includeClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    distinct: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Quản lý Reviews - Lấy danh sách review
 */
const getAllReviews = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    productId = '',
    rating = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo product
  if (productId) {
    whereClause.productId = productId;
  }

  // Filter theo rating
  if (rating) {
    whereClause.rating = parseInt(rating);
  }

  const { count, rows: reviews } = await Review.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      },
      {
        model: Product,
        attributes: ['id', 'name', 'images'],
      },
    ],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  res.status(200).json({
    status: 'success',
    data: {
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Quản lý Reviews - Xóa review
 */
const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;

  const review = await Review.findByPk(id);
  if (!review) {
    throw new AppError('Không tìm thấy đánh giá', 404);
  }

  await review.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa đánh giá thành công',
  });
});

/**
 * Quản lý Orders - Lấy danh sách đơn hàng
 */
const getAllOrders = catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status = '',
    search = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    startDate,
    endDate,
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Filter theo status
  if (status) {
    whereClause.status = status;
  }

  // Filter theo ngày
  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [new Date(startDate), new Date(endDate)],
    };
  }

  // Filter theo tìm kiếm trong order number
  if (search) {
    whereClause[Op.or] = [{ number: { [Op.like]: `%${search}%` } }];
  }

  const includeClause = [
    {
      model: User,
      attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
    },
    {
      model: OrderItem,
      as: 'items',
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'images', 'price'],
        },
      ],
    },
  ];

  const { count, rows: orders } = await Order.findAndCountAll({
    where: whereClause,
    include: includeClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  res.status(200).json({
    status: 'success',
    data: {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

/**
 * Quản lý Orders - Cập nhật trạng thái đơn hàng
 */
const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const validStatuses = [
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ];
  if (!validStatuses.includes(status)) {
    throw new AppError('Trạng thái đơn hàng không hợp lệ', 400);
  }

  const order = await Order.findByPk(id);
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', 404);
  }

  const updatedOrder = await order.update({
    status,
    note: note || order.note,
  });

  res.status(200).json({
    status: 'success',
    data: { order: updatedOrder },
  });
});

/**
 * Quản lý Products - Clone sản phẩm
 */
const cloneProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  // Tải các model cần thiết
  const {
    ProductCategory,
    ProductAttribute,
    ProductVariant,
    ProductSpecification,
    ProductWarranty,
    sequelize,
  } = require('../models');

  // 1. Tìm sản phẩm gốc với đầy đủ các quan hệ
  const originalProduct = await Product.findByPk(id, {
    include: [
      { model: Category, as: 'categories' },
      { model: ProductAttribute, as: 'attributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
      {
        model: require('../models').WarrantyPackage,
        as: 'warrantyPackages',
        through: { attributes: ['isDefault'] },
      },
    ],
  });

  if (!originalProduct) {
    throw new AppError('Không tìm thấy sản phẩm gốc', 404);
  }

  // 2. Tạo tên duy nhất cho sản phẩm clone
  let newName = originalProduct.name;
  let count = 1;
  let exists = true;
  while (exists) {
    const testName = `${originalProduct.name} (${count})`;
    const existing = await Product.findOne({ where: { name: testName } });
    if (!existing) {
      newName = testName;
      exists = false;
    } else {
      count++;
    }
  }

  // 3. Tạo SKU mới duy nhất
  const newSku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 4. Sử dụng transaction khi clone dữ liệu
  const transaction = await sequelize.transaction();

  try {
    // Clone dữ liệu sản phẩm cơ bản
    const productData = originalProduct.get({ plain: true });

    delete productData.id;
    delete productData.createdAt;
    delete productData.updatedAt;
    delete productData.slug; // Slug sẽ được generate lại bởi hook của model
    delete productData.categories;
    delete productData.attributes;
    delete productData.variants;
    delete productData.productSpecifications;
    delete productData.warrantyPackages;

    productData.name = newName;
    productData.sku = newSku;
    productData.status = 'draft'; // Mặc định là bản nháp để admin kiểm tra lại

    const newProduct = await Product.create(productData, { transaction });

    // 5. Clone các relations

    // Categories
    if (originalProduct.categories && originalProduct.categories.length > 0) {
      const categoryLinks = originalProduct.categories.map((cat) => ({
        productId: newProduct.id,
        categoryId: cat.id,
      }));

      await ProductCategory.bulkCreate(categoryLinks, { transaction });
    }

    // Attributes
    if (originalProduct.attributes && originalProduct.attributes.length > 0) {
      const attributeData = originalProduct.attributes.map((attr) => {
        const data = attr.get({ plain: true });

        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;

        return { ...data, productId: newProduct.id };
      });

      await ProductAttribute.bulkCreate(attributeData, { transaction });
    }

    // Variants
    if (originalProduct.variants && originalProduct.variants.length > 0) {
      const variantData = originalProduct.variants.map((variant) => {
        const data = variant.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;

        // Generate SKU mới cho variant dựa trên SKU mới của product
        // Giữ phần hậu tố của SKU variant nếu có
        const suffix = data.sku.includes('-')
          ? data.sku.split('-').pop()
          : Math.floor(Math.random() * 1000);

        data.sku = `${newSku}-${suffix}`;

        return { ...data, productId: newProduct.id };
      });

      await ProductVariant.bulkCreate(variantData, { transaction });
    }

    // Specifications
    if (
      originalProduct.productSpecifications &&
      originalProduct.productSpecifications.length > 0
    ) {
      const specData = originalProduct.productSpecifications.map((spec) => {
        const data = spec.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });

      await ProductSpecification.bulkCreate(specData, { transaction });
    }

    // Warranty Packages
    if (
      originalProduct.warrantyPackages &&
      originalProduct.warrantyPackages.length > 0
    ) {
      const warrantyData = originalProduct.warrantyPackages.map((wp) => ({
        productId: newProduct.id,
        warrantyPackageId: wp.id,
        isDefault: wp.ProductWarranty?.isDefault || false,
      }));
      await ProductWarranty.bulkCreate(warrantyData, { transaction });
    }

    await transaction.commit();

    // Log audit
    AdminAuditService.logProductAction(
      req.user,
      'CLONE',
      newProduct.id,
      newProduct.name,
      { originalProductId: id },
    );

    res.status(201).json({
      status: 'success',
      data: { product: newProduct },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error in cloneProduct:', error);
    throw error;
  }
});

/**
 * Quản lý Products - Thay đổi nhanh trạng thái sản phẩm
 */
const toggleProductStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Tìm sản phẩm theo ID
  const product = await Product.findByPk(id);

  // Kiểm tra sự tồn tại của sản phẩm
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  const validStatuses = ['active', 'inactive', 'draft'];

  // Nếu cung cấp status, kiểm tra tính hợp lệ
  if (status && !validStatuses.includes(status)) {
    throw new AppError('Trạng thái không hợp lệ', 400);
  }

  // Nếu không cung cấp status, mặc định là đảo ngược giữa active và inactive
  const newStatus =
    status || (product.status === 'active' ? 'inactive' : 'active');

  // Cập nhật trạng thái sản phẩm
  await product.update({ status: newStatus });

  // Log audit
  AdminAuditService.logProductAction(
    req.user,
    'UPDATE_STATUS',
    product.id,
    product.name,
    { from: product.status, to: newStatus },
  );

  res.status(200).json({
    status: 'success',
    data: { product },
  });
});

module.exports = {
  getDashboardStats,
  getDetailedStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  cloneProduct,
  toggleProductStatus,
  getAllProducts,
  getAllReviews,
  deleteReview,
  getAllOrders,
  updateOrderStatus,
};
