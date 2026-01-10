const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email/emailService');

/**
 * Tạo đơn hàng mới
 */
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      shippingFirstName,
      shippingLastName,
      shippingCompany,
      shippingAddress1,
      shippingAddress2,
      shippingCity,
      shippingState,
      shippingZip,
      shippingCountry,
      shippingPhone,
      billingFirstName,
      billingLastName,
      billingCompany,
      billingAddress1,
      billingAddress2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      billingPhone,
      paymentMethod,
      notes,
    } = req.body;

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({
      where: {
        userId,
        status: 'active',
      },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
              attributes: [
                'id',
                'name',
                'slug',
                'price',
                'thumbnail',
                'inStock',
                'stockQuantity',
                'sku',
              ],
            },
            {
              model: ProductVariant,
              attributes: ['id', 'name', 'price', 'stockQuantity', 'sku'],
            },
          ],
        },
      ],
    });

    // Nếu giỏ hàng không tồn tại hoặc trống
    if (!cart || cart.items.length === 0) {
      throw new AppError('Giỏ hàng trống', 400);
    }

    // Kiểm tra tồn kho và tính tổng

    // Tổng phụ
    let subtotal = 0;

    const tax = 0; // Tính thuế (tax) nếu cần
    const shippingCost = 0; // Tính phí vận chuyển nếu cần
    const discount = 0; // Tính giảm giá nếu cần

    for (const item of cart.items) {
      const product = item.Product;
      const variant = item.ProductVariant;

      // Kiểm tra xem sản phẩm có còn hàng không
      if (!product.inStock) {
        throw new AppError(`Sản phẩm "${product.name}" đã hết hàng`, 400);
      }

      // Kiểm tra số lượng tồn kho
      // Có 2 case: với sản phẩm có biến thể và không có biến thể
      if (variant) {
        // Case sản phẩm có biến thể
        if (variant.stockQuantity < item.quantity) {
          // Nếu không đủ số lượng tồn kho, báo lỗi
          throw new AppError(
            `Biến thể "${variant.name}" của sản phẩm "${product.name}" chỉ còn ${variant.stockQuantity} sản phẩm`,
            400,
          );
        }
      } else if (product.stockQuantity < item.quantity) {
        // Case sản phẩm không có biến thể

        // Nếu không đủ số lượng tồn kho, báo lỗi
        throw new AppError(
          `Sản phẩm "${product.name}" chỉ còn ${product.stockQuantity} sản phẩm`,
          400,
        );
      }

      // Lấy giá sản phẩm (nếu có biến thể thì lấy giá biến thể)
      const price = variant ? variant.price : product.price;

      // Cộng dồn vào tổng phụ
      subtotal += price * item.quantity;
    }

    // Tính tổng đơn hàng
    const total = subtotal + tax + shippingCost - discount;

    // Tạo số đơn hàng (order number) dạng: ORD-YYMM-XXXXX
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const count = await Order.count();
    const orderNumber = `ORD-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;

    // Tạo đơn hàng
    const order = await Order.create(
      {
        number: orderNumber,
        userId,
        shippingFirstName,
        shippingLastName,
        shippingCompany,
        shippingAddress1,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCountry,
        shippingPhone,
        billingFirstName,
        billingLastName,
        billingCompany,
        billingAddress1,
        billingAddress2,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        billingPhone,
        paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        tax,
        shippingCost,
        discount,
        total,
        notes,
      },
      { transaction },
    );

    // Tạo các mục đơn hàng
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.Product;
      const variant = item.ProductVariant;
      const price = variant ? variant.price : product.price;
      const subtotal = price * item.quantity;

      // Tạo mục đơn hàng
      const orderItem = await OrderItem.create(
        {
          orderId: order.id,
          productId: product.id,
          variantId: variant ? variant.id : null,
          name: product.name,
          sku: variant ? variant.sku : product.sku,
          price,
          quantity: item.quantity,
          subtotal,
          image: product.thumbnail,
          attributes: variant ? { variant: variant.name } : {},
        },
        { transaction },
      );

      orderItems.push(orderItem);
      // Không giảm tồn kho ở bước tạo đơn hàng để tránh vấn đề khi khách hàng không thanh toán
      // Chỉ giảm tồn kho khi nhận được xác nhận thanh toán thành công trong webhook thanh toán
    }

    // Đánh dấu giỏ hàng đã được chuyển đổi (có nghĩa là đã tạo đơn hàng từ giỏ hàng này)
    await cart.update(
      {
        status: 'converted',
      },
      { transaction },
    );

    // Xóa các mục giỏ hàng
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    await transaction.commit();

    // Gửi email xác nhận đơn hàng
    await emailService.sendOrderConfirmationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      total: order.total,
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      shippingAddress: {
        name: `${order.shippingFirstName} ${order.shippingLastName}`,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        zip: order.shippingZip,
        country: order.shippingCountry,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
        },
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Lấy danh sách đơn hàng của người dùng
 */
const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Lấy danh sách đơn hàng với phân trang và bao gồm các mục đơn hàng
    const { count, rows: orders } = await Order.findAndCountAll({
      where: { userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'images', 'price'],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết đơn hàng theo ID
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm đơn hàng theo ID và userId để đảm bảo người dùng chỉ xem được đơn hàng của mình
    const order = await Order.findOne({
      where: { id, userId },
      include: [
        {
          association: 'items',
        },
      ],
    });

    // Nếu không tìm thấy đơn hàng, trả về lỗi
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết đơn hàng theo số đơn hàng
 */
const getOrderByNumber = async (req, res, next) => {
  try {
    const { number } = req.params;
    const userId = req.user.id;

    // Tìm đơn hàng theo số đơn hàng và userId để đảm bảo người dùng chỉ xem được đơn hàng của mình
    const order = await Order.findOne({
      where: { number, userId },
      include: [
        {
          association: 'items',
        },
      ],
    });

    // Nếu không tìm thấy đơn hàng, trả về lỗi
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Hủy đơn hàng
 */
const cancelOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm đơn hàng
    const order = await Order.findOne({
      where: { id, userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
            },
            {
              model: ProductVariant,
            },
          ],
        },
      ],
    });

    // Nếu không tìm thấy đơn hàng, trả về lỗi
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Chỉ cho phép hủy đơn hàng nếu trạng thái là 'pending' hoặc 'processing'
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new AppError('Không thể hủy đơn hàng này', 400);
    }

    // Cập nhật trạng thái đơn hàng thành 'cancelled'
    await order.update(
      {
        status: 'cancelled',
      },
      { transaction },
    );

    // Khôi phục lại số lượng tồn kho
    for (const item of order.items) {
      // Có 2 case: sản phẩm có biến thể và không có biến thể
      if (item.variantId) {
        // Case sản phẩm có biến thể

        // Lấy biến thể sản phẩm
        const variant = item.ProductVariant;

        // Cập nhật lại số lượng tồn kho
        await variant.update(
          {
            stockQuantity: variant.stockQuantity + item.quantity,
          },
          { transaction },
        );
      } else {
        // Case sản phẩm không có biến thể

        // Lấy sản phẩm
        const product = item.Product;

        // Cập nhật lại số lượng tồn kho
        await product.update(
          {
            stockQuantity: product.stockQuantity + item.quantity,
          },
          { transaction },
        );
      }
    }

    await transaction.commit();

    // Gửi email thông báo hủy đơn hàng
    await emailService.sendOrderCancellationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
    });

    res.status(200).json({
      status: 'success',
      message: 'Đơn hàng đã được hủy',
      data: {
        id: order.id,
        number: order.number,
        status: 'cancelled',
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Lấy tất cả đơn hàng (Admin)
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const whereConditions = {};

    if (status) {
      whereConditions.status = status;
    }

    // Lấy danh sách đơn hàng với phân trang và bao gồm thông tin người dùng
    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật trạng thái đơn hàng (Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Tìm đơn hàng
    const order = await Order.findByPk(id, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    // Nếu không tìm thấy đơn hàng, trả về lỗi
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Cập nhật trạng thái đơn hàng
    await order.update({ status });

    // Gửi email thông báo cập nhật trạng thái đơn hàng
    await emailService.sendOrderStatusUpdateEmail(order.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      status,
    });

    res.status(200).json({
      status: 'success',
      message: 'Cập nhật trạng thái đơn hàng thành công',
      data: {
        id: order.id,
        number: order.number,
        status: order.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Thanh toán lại đơn hàng
 */
const repayOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm đơn hàng
    const order = await Order.findOne({
      where: { id, userId },
    });

    // Nếu không tìm thấy đơn hàng, trả về lỗi
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Kiểm tra trạng thái đơn hàng
    // Chỉ cho phép thanh toán lại nếu trạng thái là 'pending', 'cancelled' hoặc 'failed'
    if (
      order.status !== 'pending' &&
      order.status !== 'cancelled' &&
      order.paymentStatus !== 'failed'
    ) {
      throw new AppError('Đơn hàng này không thể thanh toán lại', 400);
    }

    // Cập nhật trạng thái đơn hàng thành 'pending' để chuẩn bị thanh toán lại
    await order.update({
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Lấy origin từ request header để tạo URL thanh toán động
    const origin = req.get('origin') || 'http://localhost:5175';

    // Tạo URL thanh toán giả lập
    // Tích hợp với cổng thanh toán
    // NOTE:
    const paymentUrl = `${origin}/checkout?repayOrder=${order.id}&amount=${order.total}`;

    res.status(200).json({
      status: 'success',
      message: 'Đơn hàng đã được cập nhật để thanh toán lại',
      data: {
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        paymentUrl: paymentUrl, // Thêm URL thanh toán vào response
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  repayOrder,
};
