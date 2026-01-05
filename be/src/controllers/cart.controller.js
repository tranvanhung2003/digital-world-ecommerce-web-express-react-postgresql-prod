const {
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { v4: uuidv4 } = require('uuid');

/**
 * Lấy giỏ hàng
 */
const getCart = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      // User đã đăng nhập - lấy hoặc tạo giỏ hàng
      [cart] = await Cart.findOrCreate({
        where: {
          userId: req.user.id,
          status: 'active',
        },
        defaults: {
          userId: req.user.id,
        },
      });
    } else {
      // Người dùng chưa đăng nhập - lấy hoặc tạo giỏ hàng theo session ID
      const { sessionId } = req.cookies;

      // Nếu không có sessionId, trả về giỏ hàng trống
      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            id: null,
            items: [],
            totalItems: 0,
            subtotal: 0,
          },
        });
      }

      // Lấy hoặc tạo giỏ hàng theo sessionId
      [cart] = await Cart.findOrCreate({
        where: {
          sessionId,
          status: 'active',
        },
        defaults: {
          sessionId,
        },
      });
    }

    // Lấy các mục giỏ hàng kèm theo chi tiết sản phẩm
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.id },
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
          ],
        },
        {
          model: ProductVariant,
          attributes: ['id', 'name', 'price', 'stockQuantity'],
        },
      ],
    });

    // Lấy các mục giỏ hàng kèm theo gói bảo hành
    const cartItemsWithWarranties = await Promise.all(
      cartItems.map(async (item) => {
        const itemData = item.toJSON();

        if (
          itemData.warrantyPackageIds &&
          itemData.warrantyPackageIds.length > 0
        ) {
          // Lấy chi tiết gói bảo hành
          const warranties = await WarrantyPackage.findAll({
            where: {
              id: itemData.warrantyPackageIds,
              isActive: true,
            },
            attributes: ['id', 'name', 'price', 'durationMonths'],
          });

          // Đính kèm gói bảo hành vào mục giỏ hàng
          itemData.warrantyPackages = warranties;
        } else {
          // Nếu không có gói bảo hành, đặt mảng rỗng
          itemData.warrantyPackages = [];
        }

        // Trả về mục giỏ hàng đã đính kèm gói bảo hành
        return itemData;
      }),
    );

    // Tính tổng số lượng tât cả các mục trong giỏ hàng
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    // Tính tổng tiền tất cả các mục trong giỏ hàng
    const subtotal = cartItemsWithWarranties.reduce((sum, item) => {
      // Nếu sản phẩm có biến thể, dùng giá biến thể, nếu không thì dùng giá sản phẩm
      const price = item.ProductVariant
        ? item.ProductVariant.price
        : item.Product.price;

      // Nếu có gói bảo hành, cộng giá gói bảo hành vào
      const warrantyPrice = item.warrantyPackages
        ? item.warrantyPackages.reduce(
            (warrantySum, warranty) => warrantySum + parseFloat(warranty.price),
            0,
          )
        : 0;

      // Tổng tiền mỗi mục = (giá sản phẩm + giá gói bảo hành) * số lượng
      return sum + (parseFloat(price) + warrantyPrice) * item.quantity;
    }, 0);

    res.status(200).json({
      status: 'success',
      data: {
        id: cart.id,
        items: cartItemsWithWarranties,
        totalItems, // Tổng số lượng tât cả các mục trong giỏ hàng
        subtotal, // Tổng tiền tất cả các mục trong giỏ hàng
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Thêm sản phẩm vào giỏ hàng
 */
const addToCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    // Lấy dữ liệu từ request body
    const {
      productId,
      variantId,
      quantity = 1,
      warrantyPackageIds = [],
    } = req.body;

    const product = await Product.findByPk(productId);

    // Kiểm tra sản phẩm có tồn tại không
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    // Kiểm tra sản phẩm còn hàng không
    if (!product.inStock) {
      throw new AppError('Sản phẩm đã hết hàng', 400);
    }

    let variant = null;

    if (variantId) {
      // Trường hợp có biến thể
      // Kiểm tra biến thể có tồn tại không
      variant = await ProductVariant.findOne({
        where: { id: variantId, productId },
      });

      // Nếu biến thể không tồn tại, báo lỗi
      if (!variant) {
        throw new AppError('Biến thể sản phẩm không tồn tại', 404);
      }

      // Kiểm tra biến thể còn hàng không, nếu không thì báo lỗi
      if (variant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (product.stockQuantity < quantity) {
      // Trường hợp không có biến thể
      // Kiểm tra sản phẩm còn hàng không, nếu không thì báo lỗi
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    let validWarrantyPackageIds = [];

    // Validate các gói bảo hành nếu được cung cấp
    if (warrantyPackageIds && warrantyPackageIds.length > 0) {
      const warranties = await WarrantyPackage.findAll({
        where: {
          id: warrantyPackageIds,
          isActive: true,
        },
      });

      // Nếu có gói bảo hành không hợp lệ, báo lỗi
      if (warranties.length !== warrantyPackageIds.length) {
        throw new AppError('Một hoặc nhiều gói bảo hành không hợp lệ', 400);
      }

      // Lấy danh sách ID của các gói bảo hành hợp lệ
      validWarrantyPackageIds = warranties.map((w) => w.id);
    }

    // Lấy hoặc tạo giỏ hàng
    let cart;

    if (req.user) {
      // Người dùng đã đăng nhập
      [cart] = await Cart.findOrCreate({
        where: {
          userId: req.user.id,
          status: 'active',
        },
        defaults: {
          userId: req.user.id,
        },
        transaction,
      });
    } else {
      // Việc hợp nhất giỏ hàng hiện được xử lý bởi endpoint /merge khi người dùng đăng nhập
      // Không phải trong lúc addToCart để tránh trùng lặp

      // Người dùng chưa đăng nhập
      let { sessionId } = req.cookies;

      // Nếu không có sessionId, tạo mới và set cookie cho người dùng
      if (!sessionId) {
        sessionId = uuidv4();

        // Set cookie với sessionId
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          sameSite: 'strict',
        });
      }

      [cart] = await Cart.findOrCreate({
        where: {
          sessionId,
          status: 'active',
        },
        defaults: {
          sessionId,
        },
        transaction,
      });
    }

    // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa (bao gồm các gói bảo hành tương tự)
    let cartItem = await CartItem.findOne({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        warrantyPackageIds: validWarrantyPackageIds,
      },
      transaction,
    });

    if (cartItem) {
      // Trường hợp sản phẩm đã có trong giỏ hàng
      // Cập nhật số lượng mới
      const newQuantity = cartItem.quantity + quantity;

      // Kiểm tra có phải sản phẩm có biến thể hay không
      if (variantId) {
        // Nếu là sản phẩm có biến thể, kiểm tra số lượng tồn kho của biến thể
        // Nếu vượt quá tồn kho, báo lỗi
        if (variant.stockQuantity < newQuantity) {
          throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
        }
      } else if (product.stockQuantity < newQuantity) {
        // Nếu là sản phẩm không có biến thể, kiểm tra số lượng tồn kho của sản phẩm
        // Nếu vượt quá tồn kho, báo lỗi
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }

      // Cập nhật số lượng mới
      await cartItem.update({ quantity: newQuantity }, { transaction });
    } else {
      // Trường hợp sản phẩm chưa có trong giỏ hàng

      // Kiểm tra có phải sản phẩm có biến thể hay không
      if (variantId) {
        // Nếu là sản phẩm có biến thể, kiểm tra số lượng tồn kho của biến thể
        // Nếu vượt quá tồn kho, báo lỗi
        if (variant.stockQuantity < quantity) {
          throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
        }
      } else if (product.stockQuantity < quantity) {
        // Nếu là sản phẩm không có biến thể, kiểm tra số lượng tồn kho của sản phẩm
        // Nếu vượt quá tồn kho, báo lỗi
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }

      // Tạo mục giỏ hàng mới
      cartItem = await CartItem.create(
        {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          price: variantId ? variant.price : product.price,
          warrantyPackageIds: validWarrantyPackageIds,
        },
        { transaction },
      );
    }

    await transaction.commit();

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Update cart item
const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Find cart item
    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          attributes: ['id', 'userId', 'sessionId'],
        },
        {
          model: Product,
          attributes: ['id', 'inStock', 'stockQuantity'],
        },
        {
          model: ProductVariant,
          attributes: ['id', 'stockQuantity'],
        },
      ],
    });

    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    // Check cart ownership
    if (req.user) {
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Check stock
    if (cartItem.ProductVariant) {
      if (cartItem.ProductVariant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (cartItem.Product.stockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    // Update quantity
    await cartItem.update({ quantity });

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find cart item
    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          attributes: ['id', 'userId', 'sessionId'],
        },
      ],
    });

    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    // Check cart ownership
    if (req.user) {
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Delete cart item
    await cartItem.destroy();

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Clear cart
const clearCart = async (req, res, next) => {
  try {
    let cartId;

    if (req.user) {
      // Logged in user
      const cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });

      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      cartId = cart.id;
    } else {
      // Guest user
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      const cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });

      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      cartId = cart.id;
    }

    // Delete all cart items
    await CartItem.destroy({
      where: { cartId },
    });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong giỏ hàng',
      data: {
        id: cartId,
        items: [],
        totalItems: 0,
        subtotal: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get cart count
const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      // Logged in user
      cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });
    } else {
      // Guest user
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            count: 0,
          },
        });
      }

      cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });
    }

    if (!cart) {
      return res.status(200).json({
        status: 'success',
        data: {
          count: 0,
        },
      });
    }

    // Count items
    const count = await CartItem.sum('quantity', {
      where: { cartId: cart.id },
    });

    res.status(200).json({
      status: 'success',
      data: {
        count: count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Sync cart from local storage to server
const syncCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { items } = req.body;

    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);
    }

    // Get or create user cart
    const [cart] = await Cart.findOrCreate({
      where: {
        userId: req.user.id,
        status: 'active',
      },
      defaults: {
        userId: req.user.id,
      },
      transaction,
    });

    // Clear current cart
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    // Add items from request
    for (const item of items) {
      const { productId, variantId, quantity } = item;

      // Validate product
      const product = await Product.findByPk(productId);
      if (!product || !product.inStock) {
        continue; // Skip invalid products
      }

      // Validate variant if provided
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, productId },
        });

        if (!variant) {
          continue; // Skip invalid variants
        }

        // Check stock and add to cart
        const actualQuantity = Math.min(quantity, variant.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              variantId,
              quantity: actualQuantity,
              price: variant.price,
            },
            { transaction },
          );
        }
      } else {
        // Check stock and add to cart
        const actualQuantity = Math.min(quantity, product.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              quantity: actualQuantity,
              price: product.price,
            },
            { transaction },
          );
        }
      }
    }

    await transaction.commit();

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Merge guest cart with user cart (called when user logs in)
const mergeCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);
    }

    const { sessionId } = req.cookies;
    if (!sessionId) {
      // No session cart to merge, just return user cart
      return getCart(req, res, next);
    }

    // Find session cart
    const sessionCart = await Cart.findOne({
      where: {
        sessionId,
        status: 'active',
      },
    });

    if (!sessionCart) {
      // No session cart to merge, just return user cart
      return getCart(req, res, next);
    }

    // Get or create user cart
    const [userCart] = await Cart.findOrCreate({
      where: {
        userId: req.user.id,
        status: 'active',
      },
      defaults: {
        userId: req.user.id,
      },
      transaction,
    });

    // Get session cart items
    const sessionItems = await CartItem.findAll({
      where: { cartId: sessionCart.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'inStock', 'stockQuantity'],
        },
        {
          model: ProductVariant,
          attributes: ['id', 'stockQuantity'],
        },
      ],
      transaction,
    });

    // Merge each session item with user cart
    for (const sessionItem of sessionItems) {
      // Check if item already exists in user cart
      const existingUserItem = await CartItem.findOne({
        where: {
          cartId: userCart.id,
          productId: sessionItem.productId,
          variantId: sessionItem.variantId || null,
        },
        transaction,
      });

      if (existingUserItem) {
        // Merge quantities
        const newQuantity = existingUserItem.quantity + sessionItem.quantity;
        const maxStock = sessionItem.ProductVariant
          ? sessionItem.ProductVariant.stockQuantity
          : sessionItem.Product.stockQuantity;

        const finalQuantity = Math.min(newQuantity, maxStock);

        await existingUserItem.update(
          { quantity: finalQuantity },
          { transaction },
        );

        // Delete the session item after merging
        await sessionItem.destroy({ transaction });
      } else {
        // Move item to user cart
        await sessionItem.update({ cartId: userCart.id }, { transaction });
      }
    }

    // Mark session cart as merged
    await sessionCart.update({ status: 'merged' }, { transaction });

    await transaction.commit();

    // Clear session cookie to prevent duplicate merging
    res.clearCookie('sessionId');

    // Return updated user cart
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  getCart,
  getCartCount,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  mergeCart,
};
