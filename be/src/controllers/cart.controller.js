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

    const currentQuantity = cartItem ? cartItem.quantity : 0;
    const finalQuantity = currentQuantity + quantity;

    const stockQuantity = variantId
      ? variant.stockQuantity
      : product.stockQuantity;

    if (stockQuantity < finalQuantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    if (cartItem) {
      // Trường hợp sản phẩm đã có trong giỏ hàng
      // Cập nhật số lượng mới
      await cartItem.update({ quantity: finalQuantity }, { transaction });
    } else {
      // Trường hợp sản phẩm chưa có trong giỏ hàng
      // Tạo mục giỏ hàng mới
      cartItem = await CartItem.create(
        {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity: finalQuantity,
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

/**
 * Cập nhật số lượng sản phẩm
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Tìm mục giỏ hàng
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

    // Kiểm tra quyền sở hữu giỏ hàng
    if (req.user) {
      // Trường hợp người dùng đã đăng nhập
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      // Trường hợp người dùng chưa đăng nhập
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Lấy số lượng tồn kho hiện tại, nếu có biến thể thì lấy của biến thể.
    // Không có biến thể thì lấy của sản phẩm.
    const stockQuantity = cartItem.ProductVariant
      ? cartItem.ProductVariant.stockQuantity
      : cartItem.Product.stockQuantity;

    // Kiểm tra nếu số lượng yêu cầu vượt quá tồn kho
    if (stockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    // Cập nhật số lượng
    await cartItem.update({ quantity });

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa sản phẩm khỏi giỏ hàng
 */
const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm mục giỏ hàng
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

    // Kiểm tra quyền sở hữu giỏ hàng
    if (req.user) {
      // Case người dùng đã đăng nhập
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      // Case người dùng chưa đăng nhập
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Xóa mục giỏ hàng
    await cartItem.destroy();

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Xóa tất cả sản phẩm trong giỏ hàng
 */
const clearCart = async (req, res, next) => {
  try {
    let cartId;

    if (req.user) {
      // Case người dùng đã đăng nhập
      // Lấy giỏ hàng của người dùng
      const cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });

      // Nếu không có giỏ hàng, trả về thông báo giỏ hàng trống
      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      // Lấy cartId
      cartId = cart.id;
    } else {
      // Case người dùng chưa đăng nhập
      const { sessionId } = req.cookies;

      // Nếu không có sessionId, trả về thông báo giỏ hàng trống
      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      // Lấy giỏ hàng theo sessionId
      const cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });

      // Nếu không có giỏ hàng, trả về thông báo giỏ hàng trống
      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      // Lấy cartId
      cartId = cart.id;
    }

    // Xóa tất cả mục giỏ hàng
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

/**
 * Lấy số lượng sản phẩm trong giỏ hàng
 */
const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      // Case người dùng đã đăng nhập
      // Lấy giỏ hàng của người dùng
      cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });
    } else {
      // Case người dùng chưa đăng nhập
      const { sessionId } = req.cookies;

      // Nếu không có sessionId, trả về count = 0
      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            count: 0,
          },
        });
      }

      // Lấy giỏ hàng theo sessionId
      cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });
    }

    // Nếu không có giỏ hàng, trả về count = 0
    if (!cart) {
      return res.status(200).json({
        status: 'success',
        data: {
          count: 0,
        },
      });
    }

    // Tính tổng số lượng sản phẩm trong giỏ hàng
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

/**
 * Sync giỏ hàng từ local storage lên server
 */
const syncCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    // Lấy dữ liệu giỏ hàng từ request body
    const { items } = req.body;

    // Kiểm tra người dùng đã đăng nhập chưa
    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);
    }

    // Lấy hoặc tạo giỏ hàng cho người dùng
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

    // Xóa tất cả mục giỏ hàng hiện tại
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    // Thêm từng mục từ local storage vào giỏ hàng
    for (const item of items) {
      const { productId, variantId, quantity } = item;

      const product = await Product.findByPk(productId);

      // Kiểm tra sản phẩm có tồn tại và còn hàng không
      // Nếu không, bỏ qua mục này
      if (!product || !product.inStock) {
        continue;
      }

      if (variantId) {
        // Case sản phẩm có biến thể

        // Kiểm tra biến thể có tồn tại không
        const variant = await ProductVariant.findOne({
          where: { id: variantId, productId },
        });

        // Nếu biến thể không tồn tại, bỏ qua mục này
        if (!variant) {
          continue;
        }

        // Lấy số lượng thực tế có thể thêm vào giỏ hàng dựa trên MIN của số lượng yêu cầu và tồn kho
        const actualQuantity = Math.min(quantity, variant.stockQuantity);
        if (actualQuantity > 0) {
          // Thêm mục vào giỏ hàng
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
        // Lấy số lượng thực tế có thể thêm vào giỏ hàng dựa trên MIN của số lượng yêu cầu và tồn kho
        const actualQuantity = Math.min(quantity, product.stockQuantity);
        if (actualQuantity > 0) {
          // Thêm mục vào giỏ hàng
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

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Gộp giỏ hàng của guest vào giỏ hàng người dùng (khi người dùng đăng nhập)
 */
const mergeCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    // Kiểm tra người dùng đã đăng nhập chưa
    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);
    }

    const { sessionId } = req.cookies;
    if (!sessionId) {
      // Nếu không có sessionId, trả về giỏ hàng người dùng
      return getCart(req, res, next);
    }

    // Lấy giỏ hàng theo sessionId
    const sessionCart = await Cart.findOne({
      where: {
        sessionId,
        status: 'active',
      },
    });

    if (!sessionCart) {
      // Nếu không có giỏ hàng theo sessionId, trả về giỏ hàng người dùng
      return getCart(req, res, next);
    }

    // Lấy hoặc tạo giỏ hàng cho người dùng
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

    // Lấy các mục giỏ hàng của session
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

    // Gộp từng mục giỏ hàng của session vào giỏ hàng người dùng
    for (const sessionItem of sessionItems) {
      // Kiểm tra mục giỏ hàng đã tồn tại trong giỏ hàng người dùng chưa
      const existingUserItem = await CartItem.findOne({
        where: {
          cartId: userCart.id,
          productId: sessionItem.productId,
          variantId: sessionItem.variantId || null,
        },
        transaction,
      });

      if (existingUserItem) {
        // Case mục đã tồn tại trong giỏ hàng người dùng

        // Tính số lượng mới sau khi gộp
        const newQuantity = existingUserItem.quantity + sessionItem.quantity;

        // Lấy tồn kho tối đa
        const maxStock = sessionItem.ProductVariant
          ? sessionItem.ProductVariant.stockQuantity
          : sessionItem.Product.stockQuantity;

        // Lấy số lượng thực tế có thể thêm vào giỏ hàng dựa trên MIN của số lượng yêu cầu và tồn kho
        const finalQuantity = Math.min(newQuantity, maxStock);

        // Cập nhật số lượng mục giỏ hàng của người dùng
        await existingUserItem.update(
          { quantity: finalQuantity },
          { transaction },
        );

        // Sau khi gộp, xóa mục giỏ hàng của session
        await sessionItem.destroy({ transaction });
      } else {
        // Case mục chưa tồn tại trong giỏ hàng người dùng

        // Lấy tồn kho tối đa
        const maxStock = sessionItem.ProductVariant
          ? sessionItem.ProductVariant.stockQuantity
          : sessionItem.Product.stockQuantity;

        // Lấy số lượng thực tế có thể thêm vào giỏ hàng dựa trên MIN của số lượng yêu cầu và tồn kho
        const finalQuantity = Math.min(sessionItem.quantity, maxStock);

        await sessionItem.update(
          { cartId: userCart.id, quantity: finalQuantity },
          { transaction },
        );
      }
    }

    // Đánh dấu giỏ hàng session là đã được gộp (merged)
    await sessionCart.update({ status: 'merged' }, { transaction });

    await transaction.commit();

    // Xóa cookie sessionId để tránh việc gộp trùng lặp
    res.clearCookie('sessionId');

    // Trả về giỏ hàng đã cập nhật
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
