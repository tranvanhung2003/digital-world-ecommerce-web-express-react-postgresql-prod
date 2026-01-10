const {
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  Product,
} = require('../models');
const productNameGeneratorService = require('../services/productNameGenerator.service');

/**
 * Lấy tất cả các nhóm thuộc tính cùng với các giá trị của chúng
 */
const getAttributeGroups = async (req, res) => {
  try {
    // Lấy tất cả các nhóm thuộc tính cùng với các giá trị của chúng
    const attributeGroups = await AttributeGroup.findAll({
      include: [
        {
          model: AttributeValue,
          as: 'values',
          where: { isActive: true },
          required: false,
          order: [
            ['sortOrder', 'ASC'],
            ['name', 'ASC'],
          ],
        },
      ],
      where: { isActive: true },
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: attributeGroups,
    });
  } catch (error) {
    console.error('Lỗi khi lấy các nhóm thuộc tính:', error);

    res.status(500).json({
      success: false,
      message: 'Lấy các nhóm thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Lấy các nhóm thuộc tính của một sản phẩm cụ thể
 */
const getProductAttributeGroups = async (req, res) => {
  try {
    const { productId } = req.params;

    // Tìm sản phẩm và bao gồm các nhóm thuộc tính cùng với các giá trị của chúng
    const product = await Product.findByPk(productId, {
      include: [
        {
          model: AttributeGroup,
          as: 'attributeGroups',
          through: {
            attributes: ['isRequired', 'sortOrder'],
          },
          include: [
            {
              model: AttributeValue,
              as: 'values',
              where: { isActive: true },
              required: false,
              order: [
                ['sortOrder', 'ASC'],
                ['name', 'ASC'],
              ],
            },
          ],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    // Nếu không tìm thấy sản phẩm, trả về lỗi 404
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm',
      });
    }

    res.json({
      success: true,
      data: product.attributeGroups,
    });
  } catch (error) {
    console.error('Lỗi khi lấy các nhóm thuộc tính của sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Lấy các nhóm thuộc tính của sản phẩm thất bại',
      error: error.message,
    });
  }
};

/**
 * Tạo nhóm thuộc tính mới
 */
const createAttributeGroup = async (req, res) => {
  try {
    const { name, description, type, isRequired, sortOrder } = req.body;

    // Tạo nhóm thuộc tính mới
    const attributeGroup = await AttributeGroup.create({
      name,
      description,
      type,
      isRequired,
      sortOrder,
    });

    res.status(201).json({
      success: true,
      data: attributeGroup,
      message: 'Nhóm thuộc tính được tạo thành công',
    });
  } catch (error) {
    console.error('Lỗi khi tạo nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Tạo nhóm thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Thêm giá trị thuộc tính vào nhóm thuộc tính
 */
const addAttributeValue = async (req, res) => {
  try {
    const { attributeGroupId } = req.params;

    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName,
      nameTemplate,
    } = req.body;

    // Tạo giá trị thuộc tính mới
    const attributeValue = await AttributeValue.create({
      attributeGroupId,
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName: affectsName || false,
      nameTemplate,
    });

    res.status(201).json({
      success: true,
      data: attributeValue,
      message: 'Giá trị thuộc tính được thêm thành công',
    });
  } catch (error) {
    console.error('Lỗi khi thêm giá trị thuộc tính:', error);

    res.status(500).json({
      success: false,
      message: 'Thêm giá trị thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Gán nhóm thuộc tính cho sản phẩm
 */
const assignAttributeGroupToProduct = async (req, res) => {
  try {
    const { productId, attributeGroupId } = req.params;

    const { isRequired, sortOrder } = req.body;

    // Tạo bản ghi gán nhóm thuộc tính cho sản phẩm
    const assignment = await ProductAttributeGroup.create({
      productId,
      attributeGroupId,
      isRequired,
      sortOrder,
    });

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Nhóm thuộc tính được gán cho sản phẩm thành công',
    });
  } catch (error) {
    console.error('Lỗi khi gán nhóm thuộc tính cho sản phẩm:', error);

    res.status(500).json({
      success: false,
      message: 'Gán nhóm thuộc tính cho sản phẩm thất bại',
      error: error.message,
    });
  }
};

/**
 * Cập nhật nhóm thuộc tính
 */
const updateAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, description, type, isRequired, sortOrder, isActive } =
      req.body;

    // Tìm nhóm thuộc tính theo ID
    const attributeGroup = await AttributeGroup.findByPk(id);

    // Nếu không tìm thấy nhóm thuộc tính, trả về lỗi 404
    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Nhóm thuộc tính không tồn tại',
      });
    }

    // Cập nhật nhóm thuộc tính
    await attributeGroup.update({
      name,
      description,
      type,
      isRequired,
      sortOrder,
      isActive,
    });

    res.json({
      success: true,
      data: attributeGroup,
      message: 'Nhóm thuộc tính được cập nhật thành công',
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Cập nhật nhóm thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Cập nhật giá trị thuộc tính
 */
const updateAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    } = req.body;

    // Tìm giá trị thuộc tính theo ID
    const attributeValue = await AttributeValue.findByPk(id);

    // Nếu không tìm thấy giá trị thuộc tính, trả về lỗi 404
    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Giá trị thuộc tính không tồn tại',
      });
    }

    // Cập nhật giá trị thuộc tính
    await attributeValue.update({
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    });

    res.json({
      success: true,
      data: attributeValue,
      message: 'Giá trị thuộc tính được cập nhật thành công',
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật giá trị thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Cập nhật giá trị thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Xóa nhóm thuộc tính (chuyển trạng thái isActive thành false)
 */
const deleteAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm nhóm thuộc tính theo ID
    const attributeGroup = await AttributeGroup.findByPk(id);

    // Nếu không tìm thấy nhóm thuộc tính, trả về lỗi 404
    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Nhóm thuộc tính không tồn tại',
      });
    }

    // Chuyển trạng thái isActive thành false
    await attributeGroup.update({ isActive: false });

    res.json({
      success: true,
      message: 'Nhóm thuộc tính được xóa thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xóa nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Xóa nhóm thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Xóa giá trị thuộc tính (chuyển trạng thái isActive thành false)
 */
const deleteAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm giá trị thuộc tính theo ID
    const attributeValue = await AttributeValue.findByPk(id);

    // Nếu không tìm thấy giá trị thuộc tính, trả về lỗi 404
    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Giá trị thuộc tính không tồn tại',
      });
    }

    // Chuyển trạng thái isActive thành false
    await attributeValue.update({ isActive: false });

    res.json({
      success: true,
      message: 'Giá trị thuộc tính được xóa thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xóa giá trị thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Xóa giá trị thuộc tính thất bại',
      error: error.message,
    });
  }
};

/**
 * Xem trước tên sản phẩm với các thuộc tính đã chọn
 */
const previewProductName = async (req, res) => {
  try {
    const { baseName, selectedAttributes, separator, includeDetails } =
      req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Tên cơ bản là bắt buộc',
      });
    }

    // Tạo preview tên sản phẩm
    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes || [],
      {
        separator: separator || ' ',
        includeDetails: includeDetails || false,
      },
    );

    res.json({
      success: true,
      data: preview,
      message: 'Xem trước tên sản phẩm thành công',
    });
  } catch (error) {
    console.error('Lỗi khi xem trước tên sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Xem trước tên sản phẩm thất bại',
      error: error.message,
    });
  }
};

/**
 * Lấy danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm
 */
const getNameAffectingAttributes = async (req, res) => {
  try {
    const { productId } = req.query;

    // Lấy các thuộc tính có ảnh hưởng đến tên sản phẩm
    const attributes =
      await productNameGeneratorService.getNameAffectingAttributes(productId);

    res.json({
      success: true,
      data: attributes,
      message:
        'Danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm được truy xuất thành công',
    });
  } catch (error) {
    console.error(
      'Lỗi khi lấy danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm:',
      error,
    );
    res.status(500).json({
      success: false,
      message:
        'Lấy danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm thất bại',
      error: error.message,
    });
  }
};

/**
 * Tạo tên sản phẩm hàng loạt dựa trên các mục đã cung cấp
 */
const batchGenerateProductNames = async (req, res) => {
  try {
    const { items, separator } = req.body;

    // Kiểm tra định dạng đầu vào của items
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items phải là một mảng',
      });
    }

    // Tạo tên sản phẩm hàng loạt
    const results = await productNameGeneratorService.batchGenerateNames(
      items,
      separator || ' ',
    );

    res.json({
      success: true,
      data: results,
      message: 'Tạo tên sản phẩm hàng loạt thành công',
    });
  } catch (error) {
    console.error('Lỗi khi tạo tên sản phẩm hàng loạt:', error);
    res.status(500).json({
      success: false,
      message: 'Tạo tên sản phẩm hàng loạt thất bại',
      error: error.message,
    });
  }
};

/**
 * Tạo tên sản phẩm theo thời gian thực dựa trên tên cơ bản và các thuộc tính đã chọn
 */
const generateNameRealTime = async (req, res) => {
  try {
    const { baseName, attributeValues, productId } = req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Tên cơ bản là bắt buộc',
      });
    }

    // Chuyển đổi đối tượng attributeValues ​​thành mảng ID
    const selectedAttributes = Array.isArray(attributeValues)
      ? attributeValues
      : Object.values(attributeValues || {}).filter((id) => id);

    //
    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes,
      {
        separator: ' ',
        includeDetails: true,
      },
    );

    // Đồng thời nhận các kết hợp thuộc tính được đề xuất nếu ProductId được cung cấp
    let suggestions = [];

    if (productId) {
      // Lấy các kết hợp thuộc tính phổ biến cho loại sản phẩm này
      suggestions = await getPopularAttributeCombinations(productId);
    }

    // Trả về tên được tạo cùng với các đề xuất
    res.json({
      success: true,
      data: {
        ...preview,
        suggestions,
        timestamp: new Date().toISOString(),
      },
      message: 'Tạo tên theo thời gian thực thành công',
    });
  } catch (error) {
    console.error('Lỗi khi tạo tên theo thời gian thực:', error);
    res.status(500).json({
      success: false,
      message: 'Tạo tên theo thời gian thực thất bại',
      error: error.message,
    });
  }
};

/**
 * Lấy các kết hợp thuộc tính phổ biến cho một sản phẩm cụ thể
 */
async function getPopularAttributeCombinations(productId) {
  try {
    const { ProductVariant } = require('../models');

    // Lấy các biến thể hiện có cho sản phẩm này để đề xuất các kết hợp phổ biến
    const existingVariants = await ProductVariant.findAll({
      where: { productId },
      attributes: ['attributeValues', 'displayName', 'name'],
      limit: 10,
      order: [['createdAt', 'DESC']],
    });

    return existingVariants.map((variant) => ({
      attributeValues: variant.attributeValues,
      displayName: variant.displayName,
      fullName: variant.name,
    }));
  } catch (error) {
    console.log('Không thể lấy các kết hợp phổ biến:', error.message);
    return [];
  }
}

module.exports = {
  getAttributeGroups,
  getProductAttributeGroups,
  createAttributeGroup,
  addAttributeValue,
  assignAttributeGroupToProduct,
  updateAttributeGroup,
  updateAttributeValue,
  deleteAttributeGroup,
  deleteAttributeValue,
  // Các endpoint mới cho việc tạo tên sản phẩm
  previewProductName,
  getNameAffectingAttributes,
  batchGenerateProductNames,
  generateNameRealTime,
};
