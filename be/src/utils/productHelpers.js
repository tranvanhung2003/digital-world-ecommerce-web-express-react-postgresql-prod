/**
 * Product Helper Functions
 * Các hàm tiện ích để quản lý tồn kho sản phầm và biến thể sản phẩm
 */

const { ProductVariant } = require('../models');

/**
 * Tính tổng số lượng hàng tồn kho từ các biến thể sản phẩm
 * @param {Array} variants Mảng các biến thể sản phẩm
 * @returns {number} Tổng lượng hàng tồn kho
 */
const calculateTotalStock = (variants) => {
  if (!variants || variants.length === 0) return 0;

  return variants.reduce(
    (total, variant) => total + (variant.stockQuantity || 0),
    0,
  );
};

/**
 * Cập nhật tổng số lượng hàng tồn kho của sản phẩm dựa trên các biến thể của nó
 * @param {string} productId ID sản phẩm
 * @param {Object} Product Product model
 * @returns {Promise<number>} Tổng số lượng hàng tồn kho đã cập nhật
 */
const updateProductTotalStock = async (productId, Product) => {
  try {
    // Lấy tất cả các biến thể của sản phẩm
    const variants = await ProductVariant.findAll({
      where: { productId },
      attributes: ['stockQuantity'],
    });

    // Tính tổng số lượng hàng tồn kho từ các biến thể
    const totalStock = calculateTotalStock(variants);

    // Cập nhật tổng số lượng hàng tồn kho và trạng thái còn hàng của sản phẩm
    await Product.update(
      {
        stockQuantity: totalStock,
        inStock: totalStock > 0,
      },
      { where: { id: productId } },
    );

    return totalStock;
  } catch (error) {
    console.log('Lỗi khi cập nhật tổng tồn kho của sản phẩm:', error);
    throw error;
  }
};

/**
 * Validate các giá trị thuộc tính biến thể dựa trên mảng thuộc tính sản phẩm
 * @param {Array} productAttributes Product attributes
 * @param {Object} variantAttributes Variant attributes
 * @returns {boolean} Trả về true nếu tất cả các giá trị thuộc tính biến thể hợp lệ, ngược lại trả về false
 */
const validateVariantAttributes = (productAttributes, variantAttributes) => {
  // Nếu không có thuộc tính sản phẩm hoặc không có thuộc tính biến thể, trả về true
  if (!productAttributes || productAttributes.length === 0) return true;
  if (!variantAttributes) return true;

  // Kiểm tra từng thuộc tính sản phẩm
  for (const productAttr of productAttributes) {
    // Lấy giá trị của thuộc tính biến thể tương ứng với tên thuộc tính sản phẩm
    const variantValue = variantAttributes[productAttr.name];

    // Nếu không có giá trị thuộc tính biến thể tương ứng, bỏ qua
    if (!variantValue) continue;

    // Kiểm tra nếu productAttr.values tồn tại và là một mảng
    if (productAttr.values && Array.isArray(productAttr.values)) {
      // Kiểm tra nếu giá trị thuộc tính biến thể không nằm trong danh sách các giá trị cho phép
      if (!productAttr.values.includes(variantValue)) {
        console.log(
          `Giá trị thuộc tính biến thể không hợp lệ: ${variantValue} không nằm trong [${productAttr.values.join(', ')}]`,
        );

        return false;
      }
    }
  }

  return true;
};

/**
 * Tạo SKU cho biến thể sản phẩm dựa trên SKU của sản phẩm gốc và các thuộc tính của biến thể
 * @param {string} productSku SKU sản phẩm gốc
 * @param {Object} attributes Các thuộc tính của biến thể
 * @returns {string} SKU cho biến thể sản phẩm
 */
const generateVariantSku = (productSku, attributes) => {
  // Tạo phần hậu tố từ các giá trị thuộc tính, chuyển thành chữ hoa và loại bỏ khoảng trắng
  const suffix = Object.values(attributes)
    .map((value) => value.toUpperCase().replace(/\s+/g, ''))
    .join('-');

  return `${productSku}-${suffix}`;
};

/**
 * Kiểm tra xem sản phẩm có biến thể hay không
 * @param {Object} product Sản phẩm cần kiểm tra
 * @returns {boolean} Trả về true nếu sản phẩm có biến thể, ngược lại trả về false
 */
const hasVariants = (product) => {
  return product.variants && product.variants.length > 0;
};

/**
 * Lấy số lượng hàng tồn kho có sẵn dựa trên sự kết hợp của các thuộc tính cụ thể
 * @param {Array} variants Các biến thể sản phẩm
 * @param {Object} selectedAttributes Các thuộc tính đã chọn
 * @returns {number} Số lượng hàng tồn kho có sẵn
 */
const getVariantStock = (variants, selectedAttributes) => {
  // Nếu không có biến thể hoặc mảng biến thể rỗng, trả về 0
  if (!variants || variants.length === 0) return 0;

  // Tìm biến thể khớp với các thuộc tính đã chọn
  const matchingVariant = variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value,
    );
  });

  // Trả về số lượng hàng tồn kho của biến thể khớp, nếu không tìm thấy thì trả về 0
  return matchingVariant ? matchingVariant.stockQuantity : 0;
};

/**
 * Lấy biến thể sản phẩm dựa trên các thuộc tính đã chọn
 * @param {Array} variants Các biến thể sản phẩm
 * @param {Object} selectedAttributes Các thuộc tính đã chọn
 * @returns {Object | null} Biến thể sản phẩm khớp, hoặc null nếu không tìm thấy
 */
const findVariantByAttributes = (variants, selectedAttributes) => {
  // Nếu không có biến thể hoặc mảng biến thể rỗng, trả về null
  if (!variants || variants.length === 0) return null;

  return variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value,
    );
  });
};

module.exports = {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
  hasVariants,
  getVariantStock,
  findVariantByAttributes,
};
