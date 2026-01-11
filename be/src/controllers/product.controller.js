const {
  Product,
  Category,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Review,
  OrderItem,
  Order,
  ProductCategory,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');
const { getField, getTableName } = require('../utils/helpers');

/**
 * Lấy tất cả sản phẩm
 */
const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
      category,
      search,
      minPrice,
      maxPrice,
      inStock,
      featured,
      status,
    } = req.query;

    // Xây dựng điều kiện lọc
    const whereConditions = {};

    // Xây dựng điều kiện include
    const includeConditions = [];

    // Filter tìm kiếm
    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { shortDescription: { [Op.iLike]: `%${search}%` } },
        // { searchKeywords: { [Op.contains]: [search] } },
        { searchKeywords: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Filter khoảng giá
    if (minPrice) {
      whereConditions.price = {
        ...whereConditions.price,
        [Op.gte]: parseFloat(minPrice),
      };
    }
    if (maxPrice) {
      whereConditions.price = {
        ...whereConditions.price,
        [Op.lte]: parseFloat(maxPrice),
      };
    }

    // Filter các sản phẩm còn hàng
    if (inStock !== undefined) {
      whereConditions.inStock = inStock === 'true';
    }

    // Filter sản phẩm nổi bật
    if (featured !== undefined) {
      whereConditions.featured = featured === 'true';
    }

    // Filter trạng thái sản phẩm - mặc định là 'active'
    if (status !== undefined) {
      whereConditions.status = status;
    } else {
      whereConditions.status = 'active';
    }

    // Filter theo danh mục
    if (category) {
      // Kiểm tra xem category có phải là UUID hợp lệ không
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          category,
        );

      if (isValidUUID) {
        // Nếu là UUID, tìm theo ID
        includeConditions.push({
          association: 'categories',
          where: { id: category },
          through: { attributes: [] },
        });
      } else {
        // Nếu không phải UUID, tìm theo slug
        includeConditions.push({
          association: 'categories',
          where: { slug: category },
          through: { attributes: [] },
        });
      }
    } else {
      // Nếu không lọc theo danh mục, vẫn include để lấy thông tin danh mục
      includeConditions.push({
        association: 'categories',
        through: { attributes: [] },
      });
    }

    // Include các thuộc tính sản phẩm
    includeConditions.push({
      association: 'attributes',
      required: false,
    });

    // Include các biến thể sản phẩm
    includeConditions.push({
      association: 'variants',
      required: false,
    });

    // Include các đánh giá để tính điểm đánh giá
    includeConditions.push({
      association: 'reviews',
      attributes: ['rating'],
    });

    // Lấy danh sách sản phẩm với phân trang và sắp xếp
    const { count, rows: productsRaw } = await Product.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      distinct: true,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sort, order]],
    });

    // Xử lý sản phẩm để thêm rating
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();

      // Tính rating trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        );

        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1),
        );

        ratings.count = productJson.reviews.length;
      }

      // Sử dụng giá biến thể nếu có, ngược lại sử dụng giá sản phẩm
      let displayPrice = parseFloat(productJson.price) || 0;
      let compareAtPrice = parseFloat(productJson.compareAtPrice) || null;

      if (productJson.variants && productJson.variants.length > 0) {
        // Sắp xếp các biến thể theo giá (tăng dần) để có giá thấp nhất trước
        const sortedVariants = productJson.variants.sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price),
        );

        displayPrice = parseFloat(sortedVariants[0].price) || displayPrice;
      }

      // Xóa phần đánh giá vì đã tính toán điểm đánh giá, không cần thiết trong response nữa
      delete productJson.reviews;

      return {
        ...productJson,
        price: displayPrice,
        compareAtPrice,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm theo ID
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'attributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'productSpecifications',
        },
        {
          association: 'reviews',
          include: [
            {
              association: 'user',
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Xử lý sản phẩm để thêm tính toán rating
    const productJson = product.toJSON();

    // Tính rating trung bình
    const ratings = {
      average: 0,
      count: 0,
    };

    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );

      ratings.average = parseFloat(
        (totalRating / productJson.reviews.length).toFixed(1),
      );

      ratings.count = productJson.reviews.length;
    }

    // Thêm rating vào dữ liệu sản phẩm
    const productWithRatings = {
      ...productJson,
      ratings,
    };

    res.status(200).json({
      status: 'success',
      data: productWithRatings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm theo slug
 */
const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { skuId } = req.query;

    const product = await Product.findOne({
      where: { slug },
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'attributes',
        },
        {
          association: 'variants',
          where: { isAvailable: true },
          required: false,
        },
        {
          association: 'reviews',
          include: [
            {
              association: 'user',
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Xử lý sản phẩm để thêm tính toán rating
    const productJson = product.toJSON();

    // Tính rating trung bình
    const ratings = {
      average: 0,
      count: 0,
    };

    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );

      ratings.average = parseFloat(
        (totalRating / productJson.reviews.length).toFixed(1),
      );

      ratings.count = productJson.reviews.length;
    }

    let responseData = {
      ...productJson,
      ratings,
    };

    // Nếu là sản phẩm có biến thể thì cần xử lý thêm phần biến thể
    // Nếu sản phẩm không có biến thể thì không cần xử lý gì thêm
    if (
      productJson.isVariantProduct &&
      productJson.variants &&
      productJson.variants.length > 0
    ) {
      // Case sản phẩm có biến thể

      let selectedVariant = null;

      // Nếu skuId được cung cấp, tìm biến thể tương ứng
      if (skuId) {
        selectedVariant = productJson.variants.find((v) => v.id === skuId);
      }

      // Nếu skuId không được cung cấp hoặc không tìm thấy biến thể tương ứng với skuId
      // thì lấy biến thể mặc định hoặc biến thể đầu tiên
      if (!selectedVariant) {
        selectedVariant =
          productJson.variants.find((v) => v.isDefault) ||
          productJson.variants[0];
      }

      if (selectedVariant) {
        // Ghi đè dữ liệu sản phẩm bằng dữ liệu biến thể đã chọn

        responseData = {
          ...responseData,

          // Thông tin biến thể hiện tại được chọn
          currentVariant: {
            id: selectedVariant.id,
            name: selectedVariant.variantName,
            fullName: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName}`,
            price: selectedVariant.price,
            compareAtPrice: selectedVariant.compareAtPrice,
            sku: selectedVariant.sku,
            stockQuantity: selectedVariant.stockQuantity,
            specifications: {
              ...productJson.specifications,
              ...selectedVariant.specifications,
            },
            images:
              selectedVariant.images && selectedVariant.images.length > 0
                ? selectedVariant.images
                : productJson.images,
          },

          // Tất cả các biến thể có sẵn để lựa chọn trên giao diện
          availableVariants: productJson.variants.map((v) => ({
            id: v.id,
            name: v.variantName,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stockQuantity: v.stockQuantity,
            isDefault: v.isDefault,
            sku: v.sku,
          })),

          // Ghi đè các trường sản phẩm chính bằng biến thể đã chọn
          name: `${productJson.baseName || productJson.name} - ${selectedVariant.variantName}`,
          price: selectedVariant.price,
          compareAtPrice: selectedVariant.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          specifications: {
            ...productJson.specifications,
            ...selectedVariant.specifications,
          },
          images:
            selectedVariant.images && selectedVariant.images.length > 0
              ? selectedVariant.images
              : productJson.images,
        };
      }
    }

    res.status(200).json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tạo sản phẩm mới (Admin)
 */
const createProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      baseName,
      description,
      shortDescription,
      price,
      compareAtPrice,
      images,
      thumbnail,
      categoryIds,
      inStock,
      stockQuantity,
      featured,
      searchKeywords,
      seoTitle,
      seoDescription,
      seoKeywords,
      specifications,
      parentAttributes,
      attributes,
      variants,
      warrantyPackageIds,
    } = req.body;

    // Xác định xem đây có phải là sản phẩm có biến thể không
    const isVariantProduct = variants && variants.length > 0;

    // Tạo sản phẩm
    const product = await Product.create(
      {
        name,
        baseName: baseName || name,
        description,
        shortDescription,
        price: isVariantProduct ? 0 : price, // Đặt là 0 nếu là sản phẩm có biến thể
        compareAtPrice: isVariantProduct ? null : compareAtPrice, // Đặt là null nếu là sản phẩm có biến thể
        images: images || [],
        thumbnail,
        inStock: isVariantProduct ? true : inStock, // Luôn luôn true đối với sản phẩm có biến thể
        stockQuantity: isVariantProduct ? 0 : stockQuantity, // Đặt là 0 nếu là sản phẩm có biến thể
        featured,
        searchKeywords: searchKeywords || [],
        seoTitle,
        seoDescription,
        seoKeywords: seoKeywords || [],
        isVariantProduct,
        specifications: specifications || {},
      },
      { transaction },
    );

    // Thêm danh mục
    if (categoryIds && categoryIds.length > 0) {
      const categories = await Category.findAll({
        where: { id: { [Op.in]: categoryIds } },
      });

      // Kiểm tra xem các danh mục có tồn tại không
      if (categories.length !== categoryIds.length) {
        throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
      }

      await product.setCategories(categories, { transaction });
    }

    // Thêm thông số kỹ thuật
    if (specifications && specifications.length > 0) {
      const productSpecifications = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: index,
      }));

      await ProductSpecification.bulkCreate(productSpecifications, {
        transaction,
      });
    }

    // Thêm các thuộc tính
    if (parentAttributes && parentAttributes.length > 0) {
      const productParentAttributes = parentAttributes.map((attr, index) => ({
        productId: product.id,
        name: attr.name,
        type: attr.type,
        values: attr.values,
        required: attr.required,
        sortOrder: index,
      }));

      await ProductAttribute.bulkCreate(productParentAttributes, {
        transaction,
      });
    }

    // Thêm thuộc tính (để tương thích ngược với version cũ)
    // Version cũ dùng attributes, version mới dùng parentAttributes
    if (attributes && attributes.length > 0) {
      const productAttributes = attributes.map((attr) => ({
        ...attr,
        productId: product.id,
      }));

      await ProductAttribute.bulkCreate(productAttributes, { transaction });
    }

    // Thêm các biến thể
    if (variants && variants.length > 0) {
      const productVariants = variants.map((variant, index) => ({
        productId: product.id,
        sku: variant.sku || `${product.id}-VAR-${index + 1}`,
        variantName: variant.name || variant.variantName,
        price: parseFloat(variant.price) || 0,
        compareAtPrice: variant.compareAtPrice
          ? parseFloat(variant.compareAtPrice)
          : null,
        stockQuantity: parseInt(variant.stockQuantity || variant.stock) || 0,
        // Đặt isDefault cho biến thể đầu tiên nếu không có biến thể nào được đánh dấu là mặc định
        isDefault: variant.isDefault || index === 0,
        isAvailable: variant.isAvailable !== false,
        attributes: variant.attributes || {},
        attributeValues: variant.attributeValues || {},
        specifications: variant.specifications || {},
        images: variant.images || [],
        displayName: variant.displayName || variant.name || variant.variantName,
        sortOrder: variant.sortOrder || index,
      }));

      await ProductVariant.bulkCreate(productVariants, { transaction });
    }

    // Thêm các gói bảo hành
    if (warrantyPackageIds && warrantyPackageIds.length > 0) {
      const { WarrantyPackage } = require('../models');
      const warranties = await WarrantyPackage.findAll({
        where: { id: { [Op.in]: warrantyPackageIds } },
      });

      // Kiểm tra xem các gói bảo hành có tồn tại không
      if (warranties.length !== warrantyPackageIds.length) {
        throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
      }

      await product.setWarrantyPackages(warranties, { transaction });
    }

    await transaction.commit();

    // Lấy thông tin sản phẩm vừa mới tạo cùng với các quan hệ
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'attributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'productSpecifications',
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          where: { isActive: true },
          required: false,
        },
      ],
    });

    res.status(201).json({
      status: 'success',
      data: createdProduct,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Cập nhật sản phẩm (Admin)
 */
const updateProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      images,
      thumbnail,
      categoryIds,
      inStock,
      stockQuantity,
      featured,
      searchKeywords,
      seoTitle,
      seoDescription,
      seoKeywords,
      attributes,
      variants,
      warrantyPackageIds,
    } = req.body;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Các trường dữ liệu sẽ được cập nhật
    const updateData = {};

    // Chỉ cập nhật các trường có trong request body
    if (req.body.hasOwnProperty('name')) updateData.name = name;
    if (req.body.hasOwnProperty('description'))
      updateData.description = description;
    if (req.body.hasOwnProperty('shortDescription'))
      updateData.shortDescription = shortDescription;
    if (req.body.hasOwnProperty('price')) updateData.price = price;
    if (req.body.hasOwnProperty('compareAtPrice'))
      updateData.compareAtPrice = compareAtPrice;
    if (req.body.hasOwnProperty('images')) updateData.images = images;
    if (req.body.hasOwnProperty('thumbnail')) updateData.thumbnail = thumbnail;
    if (req.body.hasOwnProperty('inStock')) updateData.inStock = inStock;
    if (req.body.hasOwnProperty('stockQuantity'))
      updateData.stockQuantity = stockQuantity;
    if (req.body.hasOwnProperty('featured')) updateData.featured = featured;
    if (req.body.hasOwnProperty('searchKeywords'))
      updateData.searchKeywords = searchKeywords;
    if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
    if (req.body.hasOwnProperty('seoDescription'))
      updateData.seoDescription = seoDescription;
    if (req.body.hasOwnProperty('seoKeywords'))
      updateData.seoKeywords = seoKeywords;

    // Cập nhật sản phẩm với dữ liệu mới
    await product.update(updateData, { transaction });

    // Cập nhật danh mục - chỉ khi categoryIds được gửi trong request
    if (req.body.hasOwnProperty('categoryIds') && categoryIds) {
      const categories = await Category.findAll({
        where: { id: { [Op.in]: categoryIds } },
      });

      if (categories.length !== categoryIds.length) {
        throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
      }

      await product.setCategories(categories, { transaction });
    }

    // Cập nhật thuộc tính - chỉ khi attributes được gửi trong request
    if (req.body.hasOwnProperty('attributes')) {
      // Xóa các thuộc tính hiện có của sản phẩm này
      await ProductAttribute.destroy({
        where: { productId: id },
        transaction,
      });

      // Tạo các thuộc tính mới
      if (attributes && attributes.length > 0) {
        const productAttributes = attributes.map((attr) => ({
          ...attr,
          productId: id,
        }));

        await ProductAttribute.bulkCreate(productAttributes, { transaction });
      }
    }

    // Cập nhật các biến thể sản phẩm - chỉ khi variants được gửi trong request
    if (req.body.hasOwnProperty('variants')) {
      // Xóa các biến thể hiện có của sản phẩm này
      await ProductVariant.destroy({
        where: { productId: id },
        transaction,
      });

      // Tạo các biến thể mới
      if (variants && variants.length > 0) {
        const productVariants = variants.map((variant) => ({
          ...variant,
          productId: id,
        }));

        await ProductVariant.bulkCreate(productVariants, { transaction });
      }
    }

    // Cập nhật các gói bảo hành - chỉ khi warrantyPackageIds được gửi trong request
    if (req.body.hasOwnProperty('warrantyPackageIds')) {
      // Có 2 case: cập nhật các gói bảo hành mới hoặc xóa tất cả gói bảo hành

      if (warrantyPackageIds && warrantyPackageIds.length > 0) {
        // Case cập nhật các gói bảo hành mới

        const { WarrantyPackage } = require('../models');

        const warranties = await WarrantyPackage.findAll({
          where: { id: { [Op.in]: warrantyPackageIds } },
        });

        if (warranties.length !== warrantyPackageIds.length) {
          throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
        }

        await product.setWarrantyPackages(warranties, { transaction });
      } else {
        // Case xóa tất cả gói bảo hành

        await product.setWarrantyPackages([], { transaction });
      }
    }

    await transaction.commit();

    // Lấy thông tin sản phẩm vừa mới cập nhật cùng với các quan hệ
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'attributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          where: { isActive: true },
          required: false,
        },
      ],
    });

    res.status(200).json({
      status: 'success',
      data: updatedProduct,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Xóa sản phẩm (Admin)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Xóa sản phẩm
    await product.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Xóa sản phẩm thành công',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm nổi bật
 */
const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const productsRaw = await Product.findAll({
      where: { featured: true },
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'reviews',
          attributes: ['rating'],
        },
        {
          association: 'variants',
          attributes: ['id', 'name', 'price', 'stockQuantity', 'sku'],
        },
      ],
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    // Thêm ratings vào các sản phẩm
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();

      // Tính rating trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        );

        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1),
        );

        ratings.count = productJson.reviews.length;
      }

      // Sử dụng giá variant nếu có, nếu không thì sử dụng giá sản phẩm
      let displayPrice = parseFloat(productJson.price) || 0;
      let compareAtPrice = parseFloat(productJson.compareAtPrice) || null;

      if (productJson.variants && productJson.variants.length > 0) {
        // Case sản phẩm có biến thể

        // Sắp xếp variants theo giá (tăng dần) để lấy giá thấp nhất trước
        const sortedVariants = productJson.variants.sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price),
        );
        displayPrice = parseFloat(sortedVariants[0].price) || displayPrice;
      }

      // Xóa phần đánh giá vì đã tính toán điểm đánh giá, không cần thiết trong response nữa
      delete productJson.reviews;

      return {
        ...productJson,
        price: displayPrice,
        compareAtPrice,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm liên quan
 */
const getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    // Tìm sản phẩm hiện tại để lấy danh mục
    const product = await Product.findByPk(id, {
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
      ],
    });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy danh sách ID danh mục của sản phẩm hiện tại
    const categoryIds = product.categories.map((category) => category.id);

    let relatedProductsRaw = [];

    // Nếu sản phẩm có các danh mục, tìm các sản phẩm liên quan theo các danh mục đó
    if (categoryIds.length > 0) {
      relatedProductsRaw = await Product.findAll({
        include: [
          {
            association: 'categories',
            where: { id: { [Op.in]: categoryIds } },
            through: { attributes: [] },
          },
          {
            association: 'reviews',
            attributes: ['rating'],
          },
        ],
        where: {
          id: { [Op.ne]: id }, // Loại bỏ sản phẩm hiện tại
        },
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
      });
    }

    // Nếu sản phẩm hiện tại không có danh mục hoặc không tìm thấy sản phẩm liên quan theo danh mục,
    // thì trả về các sản phẩm mới nhất hoặc sản phẩm nổi bật
    if (relatedProductsRaw.length === 0) {
      relatedProductsRaw = await Product.findAll({
        include: [
          {
            association: 'reviews',
            attributes: ['rating'],
          },
        ],
        where: {
          id: { [Op.ne]: id }, // Loại bỏ sản phẩm hiện tại
          status: 'active', // Chỉ lấy sản phẩm đang hoạt động
        },
        limit: parseInt(limit),
        order: [
          ['featured', 'DESC'], // Ưu tiên các sản phẩm nổi bật
          ['createdAt', 'DESC'], // Sau đó là sản phẩm mới nhất
        ],
      });
    }

    // Thêm ratings vào các sản phẩm liên quan
    const relatedProducts = relatedProductsRaw.map((product) => {
      const productJson = product.toJSON();

      // Tính rating trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        );

        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1),
        );

        ratings.count = productJson.reviews.length;
      }

      // Xóa phần đánh giá vì đã tính toán điểm đánh giá, không cần thiết trong response nữa
      delete productJson.reviews;

      return {
        ...productJson,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: relatedProducts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tìm kiếm sản phẩm
 */
const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      throw new AppError('Từ khóa tìm kiếm là bắt buộc', 400);
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { shortDescription: { [Op.iLike]: `%${q}%` } },
          // { searchKeywords: { [Op.contains]: [q] } },
          { searchKeywords: { [Op.iLike]: `%${q}%` } },
        ],
      },
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
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
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm mới về
 */
const getNewArrivals = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const productsRaw = await Product.findAll({
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'reviews',
          attributes: ['rating'],
        },
      ],
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    // Thêm ratings vào các sản phẩm
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();

      // Tính rating trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0,
        );

        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1),
        );

        ratings.count = productJson.reviews.length;
      }

      // Xóa phần đánh giá vì đã tính toán điểm đánh giá, không cần thiết trong response nữa
      delete productJson.reviews;

      return {
        ...productJson,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm bán chạy nhất
 */
const getBestSellers = async (req, res, next) => {
  try {
    const { limit = 10, period = 'month' } = req.query;

    // Tính phạm vi ngày dựa trên period
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        // Mặc định là 1 tháng
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Lấy các sản phẩm được bán chạy nhất dựa trên số lượng đã bán trong khoảng thời gian đã cho

    // Lấy tên bảng và tên các trường từ Model để tránh lỗi khi tên bảng hoặc trường bị thay đổi
    const productTableName = getTableName(Product);
    const Product_name = getField(Product, 'name');
    const Product_slug = getField(Product, 'slug');
    const Product_price = getField(Product, 'price');
    const Product_compareAtPrice = getField(Product, 'compareAtPrice');
    const Product_thumbnail = getField(Product, 'thumbnail');
    const Product_inStock = getField(Product, 'inStock');
    const Product_stockQuantity = getField(Product, 'stockQuantity');
    const Product_featured = getField(Product, 'featured');

    const orderItemTableName = getTableName(OrderItem);
    const OrderItem_productId = getField(OrderItem, 'productId');
    const OrderItem_orderId = getField(OrderItem, 'orderId');
    const OrderItem_quantity = getField(OrderItem, 'quantity');

    const orderTableName = getTableName(Order);
    const Order_status = getField(Order, 'status');
    const Order_createdAt = getField(Order, 'createdAt');

    const bestSellers = await sequelize.query(
      `
      SELECT 
        p.id, 
        p.${Product_name}, 
        p.${Product_slug}, 
        p.${Product_price}, 
        p.${Product_compareAtPrice}, 
        p.${Product_thumbnail}, 
        p.${Product_inStock}, 
        p.${Product_stockQuantity}, 
        p.${Product_featured}, 
        COUNT(oi.${OrderItem_productId}) as sales_count, 
        SUM(oi.${OrderItem_quantity}) as units_sold 
      FROM ${productTableName} p 
      JOIN ${orderItemTableName} oi ON p.id = oi.${OrderItem_productId} 
      JOIN ${orderTableName} o ON oi.${OrderItem_orderId} = o.id 
      WHERE o.${Order_status} != 'cancelled' 
      AND o.${Order_createdAt} >= :startDate 
      GROUP BY p.id 
      ORDER BY units_sold DESC 
      LIMIT :limit
      `,
      {
        replacements: { startDate, limit: parseInt(limit) },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    // Nếu không tìm thấy sản phẩm bán chạy, trả về sản phẩm mới về
    if (bestSellers.length === 0) {
      return await getNewArrivals(req, res, next);
    }

    // Lấy danh sách ID sản phẩm bán chạy
    const productIds = bestSellers.map((product) => product.id);

    // Lấy chi tiết đầy đủ của sản phẩm
    const products = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
      ],
      order: [
        [
          // Sắp xếp theo đúng thứ tự của productIds (từ bán chạy nhất đến ít chạy hơn)
          sequelize.literal(
            `CASE ${productIds
              .map((id, index) => `WHEN "Product"."id" = '${id}' THEN ${index}`)
              .join(' ')} END`,
          ),
        ],
      ],
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy sản phẩm khuyến mãi
 */
const getDeals = async (req, res, next) => {
  try {
    const { minDiscount = 5, limit = 12, sort = 'discount_desc' } = req.query;

    // Lấy tất cả sản phẩm có giá so sánh
    const allProducts = await Product.findAll({
      where: {
        compareAtPrice: { [Op.ne]: null },
      },
      include: [
        {
          association: 'categories',
          through: { attributes: [] },
        },
        {
          association: 'reviews',
          attributes: ['rating'],
        },
      ],
    });

    // Thêm phần trăm giảm giá vào từng sản phẩm và lọc theo minDiscount
    // Phần trăm giảm giá phải lớn hơn hoặc bằng minDiscount
    const discountedProducts = allProducts
      .map((product) => {
        const price = parseFloat(product.price);

        const compareAtPrice = parseFloat(product.compareAtPrice);

        const discountPercentage =
          ((compareAtPrice - price) / compareAtPrice) * 100;

        // Tính rating trung bình
        const ratings = {
          average: 0,
          count: 0,
        };

        if (product.reviews && product.reviews.length > 0) {
          const totalRating = product.reviews.reduce(
            (sum, review) => sum + review.rating,
            0,
          );

          ratings.average = parseFloat(
            (totalRating / product.reviews.length).toFixed(1),
          );

          ratings.count = product.reviews.length;
        }

        // Trả về sản phẩm cùng với phần trăm giảm giá và ratings
        return {
          ...product.toJSON(),
          discountPercentage,
          ratings,
        };
      })
      .filter(
        (product) => product.discountPercentage >= parseFloat(minDiscount),
      );

    // Sắp xếp sản phẩm theo yêu cầu sắp xếp
    let sortedProducts;
    switch (sort) {
      case 'price_asc':
        sortedProducts = discountedProducts.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        sortedProducts = discountedProducts.sort((a, b) => b.price - a.price);
        break;
      case 'discount_desc':
      default:
        // Mặc định sắp xếp theo phần trăm giảm giá giảm dần
        sortedProducts = discountedProducts.sort(
          (a, b) => b.discountPercentage - a.discountPercentage,
        );
    }

    // Giới hạn số lượng sản phẩm trả về
    const limitedProducts = sortedProducts.slice(0, parseInt(limit));

    res.status(200).json({
      status: 'success',
      data: limitedProducts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy các biến thể của sản phẩm
 */
const getProductVariants = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy các biến thể của sản phẩm
    const variants = await ProductVariant.findAll({
      where: { productId: id },
    });

    res.status(200).json({
      status: 'success',
      data: {
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy tóm tắt đánh giá sản phẩm
 */
const getProductReviewsSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy tất cả đánh giá của sản phẩm
    const reviews = await Review.findAll({
      where: { productId: id },
      attributes: ['rating'],
    });

    // Đếm số lượng đánh giá
    const count = reviews.length;

    // Tính điểm đánh giá trung bình
    const average =
      count > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / count
        : 0;

    // Tính phân bố điểm đánh giá
    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    // Đếm số lượng đánh giá cho mỗi điểm (1 đến 5)
    reviews.forEach((review) => {
      distribution[review.rating]++;
    });

    res.status(200).json({
      status: 'success',
      data: {
        average,
        count,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy bộ lọc sản phẩm
 */
const getProductFilters = async (req, res, next) => {
  try {
    const { categoryId } = req.query;

    console.log('Đang lấy bộ lọc sản phẩm với categoryId:', categoryId);

    const whereCondition = {};

    const includeCondition = [];

    if (categoryId) {
      // Kiểm tra xem categoryId có phải là UUID hợp lệ không
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          categoryId,
        );

      if (isValidUUID) {
        includeCondition.push({
          association: 'categories',
          where: { id: categoryId },
          through: { attributes: [] },
          required: false, // Đặt required: false để tránh lỗi khi không tìm thấy danh mục
        });
      } else {
        // Nếu không phải UUID, có thể là slug
        const category = await Category.findOne({
          where: { slug: categoryId },
        });

        if (category) {
          includeCondition.push({
            association: 'categories',
            where: { id: category.id },
            through: { attributes: [] },
            required: false, // Đặt required: false để tránh lỗi khi không tìm thấy danh mục
          });
        }
      }
    }

    const Product_price = getField(Product, 'price');

    // Lấy khoảng giá
    const priceRange = await Product.findAll({
      attributes: [
        [sequelize.fn('MIN', sequelize.col(Product_price)), 'min'],
        [sequelize.fn('MAX', sequelize.col(Product_price)), 'max'],
      ],
      where: whereCondition,
      include: includeCondition,
      // Nếu có categoryId thì thêm group by để tránh lỗi
      group: categoryId ? ['categories.id'] : undefined,
      raw: true,
    });

    // Lấy category ID thực tế nếu có
    let actualCategoryId = null;
    if (categoryId) {
      const isValidUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          categoryId,
        );

      if (isValidUUID) {
        // Case categoryId là UUID hợp lệ

        actualCategoryId = categoryId;
      } else {
        // Case categoryId là slug

        const category = await Category.findOne({
          where: { slug: categoryId },
        });

        if (category) {
          actualCategoryId = category.id;
        }
      }
    }

    // Xây dựng điều kiện lọc sản phẩm theo danh mục
    let productFilter = {};
    if (actualCategoryId) {
      const productCategoryTableName = getTableName(ProductCategory);
      const ProductCategory_productId = getField(ProductCategory, 'productId');
      const ProductCategory_categoryId = getField(
        ProductCategory,
        'categoryId',
      );

      // Nếu có categoryId, lọc sản phẩm theo danh mục đó
      productFilter = {
        productId: {
          [Op.in]: sequelize.literal(
            `(SELECT ${ProductCategory_productId} FROM ${productCategoryTableName} WHERE ${ProductCategory_categoryId} = '${actualCategoryId}')`,
          ),
        },
      };
    }

    // Lấy các thương hiệu
    const brands = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'brand',
        ...(actualCategoryId ? productFilter : {}),
      },
      raw: true,
    });

    // Lấy màu sắc
    const colors = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'color',
        ...(actualCategoryId ? productFilter : {}),
      },
      raw: true,
    });

    // Lấy kích thước
    const sizes = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'size',
        ...(actualCategoryId ? productFilter : {}),
      },
      raw: true,
    });

    // Lấy các thuộc tính khác
    const otherAttributes = await ProductAttribute.findAll({
      attributes: ['name', 'values'],
      where: {
        name: { [Op.notIn]: ['brand', 'color', 'size'] },
        ...(actualCategoryId ? productFilter : {}),
      },
      group: ['name', 'values'],
      raw: true,
    });

    // Xử lý dữ liệu trả về
    const uniqueBrands = new Set();
    brands.forEach((brand) => {
      if (brand.values && Array.isArray(brand.values)) {
        brand.values.forEach((value) => uniqueBrands.add(value));
      }
    });

    const uniqueColors = new Set();
    colors.forEach((color) => {
      if (color.values && Array.isArray(color.values)) {
        color.values.forEach((value) => uniqueColors.add(value));
      }
    });

    const uniqueSizes = new Set();
    sizes.forEach((size) => {
      if (size.values && Array.isArray(size.values)) {
        size.values.forEach((value) => uniqueSizes.add(value));
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        priceRange: {
          min: parseFloat(priceRange[0]?.min || 0),
          max: parseFloat(priceRange[0]?.max || 0),
        },
        brands: Array.from(uniqueBrands),
        colors: Array.from(uniqueColors),
        sizes: Array.from(uniqueSizes),
        attributes: otherAttributes.map((attr) => ({
          name: attr.name,
          values: attr.values || [],
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getRelatedProducts,
  searchProducts,
  getNewArrivals,
  getBestSellers,
  getDeals,
  getProductVariants,
  getProductReviewsSummary,
  getProductFilters,
};
