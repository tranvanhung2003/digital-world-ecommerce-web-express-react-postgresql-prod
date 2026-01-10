const { WarrantyPackage, ProductWarranty, Product } = require('../models');
const { validationResult } = require('express-validator');

/**
 * Lấy tất cả gói bảo hành
 */
const getAllWarrantyPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    // Lấy danh sách gói bảo hành với phân trang và lọc
    const { count, rows } = await WarrantyPackage.findAndCountAll({
      where: whereClause,
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    res.json({
      status: 'success',
      data: {
        warrantyPackages: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('Lỗi khi lấy tất cả gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

/**
 * Lấy gói bảo hành theo sản phẩm
 */
const getWarrantyPackagesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Kiểm tra xem sản phẩm có tồn tại không
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Sản phẩm không tồn tại',
      });
    }

    // Lấy các gói bảo hành cho sản phẩm này
    const productWarranties = await ProductWarranty.findAll({
      where: { productId },
      include: [
        {
          model: WarrantyPackage,
          as: 'warrantyPackage',
          where: { isActive: true },
        },
      ],
      order: [
        [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'sortOrder', 'ASC'],
        [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'price', 'ASC'],
      ],
    });

    // Trích xuất thông tin các gói bảo hành với isDefault
    const warrantyPackages = productWarranties.map((pw) => ({
      ...pw.warrantyPackage.toJSON(),
      isDefault: pw.isDefault,
    }));

    res.json({
      status: 'success',
      data: {
        warrantyPackages,
        productId,
      },
    });
  } catch (error) {
    console.error('Lỗi khi lấy các gói bảo hành theo sản phẩm:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

/**
 * Lấy gói bảo hành theo ID
 */
const getWarrantyPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Gói bảo hành không tồn tại',
      });
    }

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Lỗi khi lấy gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

/**
 * Tạo gói bảo hành (Admin)
 */
const createWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Lỗi xác thực dữ liệu',
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive = true,
      sortOrder = 0,
    } = req.body;

    const warrantyPackage = await WarrantyPackage.create({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    });

    res.status(201).json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Lỗi khi tạo gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

/**
 * Cập nhật gói bảo hành (Admin)
 */
const updateWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Lỗi xác thực dữ liệu',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    } = req.body;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy gói bảo hành',
      });
    }

    await warrantyPackage.update({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    });

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

/**
 * Xóa gói bảo hành (Admin)
 */
const deleteWarrantyPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Gói bảo hành không tồn tại',
      });
    }

    // Kiểm tra xem gói bảo hành có đang được sử dụng không
    const isUsed = await ProductWarranty.findOne({
      where: { warrantyPackageId: id },
    });

    // Nếu đang được sử dụng, không cho xóa
    if (isUsed) {
      return res.status(400).json({
        status: 'error',
        message: 'Không thể xóa gói bảo hành đang được sử dụng bởi sản phẩm',
      });
    }

    await warrantyPackage.destroy();

    res.json({
      status: 'success',
      message: 'Xóa gói bảo hành thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xóa gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ',
    });
  }
};

module.exports = {
  getAllWarrantyPackages,
  getWarrantyPackagesByProduct,
  getWarrantyPackageById,
  createWarrantyPackage,
  updateWarrantyPackage,
  deleteWarrantyPackage,
};
