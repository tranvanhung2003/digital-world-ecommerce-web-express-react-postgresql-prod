const { AttributeValue, AttributeGroup } = require('../models');

// Định nghĩa các quan hệ nếu chúng chưa tồn tại
if (!AttributeValue.associations.attributeGroup) {
  AttributeValue.belongsTo(AttributeGroup, {
    foreignKey: 'attributeGroupId',
    as: 'attributeGroup',
  });
}

if (!AttributeGroup.associations.values) {
  AttributeGroup.hasMany(AttributeValue, {
    foreignKey: 'attributeGroupId',
    as: 'values',
  });
}

/**
 * Service tạo tên sản phẩm động dựa trên các thuộc tính đã chọn
 */
class ProductNameGeneratorService {
  /**
   * Tạo tên sản phẩm dựa trên tên gốc và các giá trị thuộc tính đã chọn
   * @param {string} baseName - Tên gốc của sản phẩm (ví dụ: "ThinkPad X1 Carbon")
   * @param {Array} selectedAttributes - Mảng các ID giá trị thuộc tính đã chọn
   * @param {string} separator - Ký tự phân tách giữa các phần của tên (mặc định: " ")
   * @returns {Promise<string>} Tên sản phẩm được tạo
   */
  async generateProductName(
    baseName,
    selectedAttributes = [],
    separator = ' ',
  ) {
    try {
      // Nếu không có tên gốc, trả về lỗi
      if (!baseName) {
        throw new Error('Tên gốc của sản phẩm không được để trống');
      }

      // Nếu không có thuộc tính đã chọn, trả về tên gốc
      if (!selectedAttributes.length) {
        return baseName;
      }

      // Lấy các giá trị thuộc tính có ảnh hưởng đến tên
      const attributeValues = await AttributeValue.findAll({
        where: {
          id: selectedAttributes,
          affectsName: true, // Chỉ lấy các thuộc tính có ảnh hưởng đến tên
          isActive: true,
        },
        include: [
          {
            model: AttributeGroup,
            as: 'attributeGroup',
            attributes: ['name', 'type', 'sortOrder'],
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      // Nếu không có giá trị thuộc tính nào ảnh hưởng đến tên, trả về tên gốc
      if (!attributeValues.length) {
        return baseName;
      }

      // Xây dựng các phần của tên dựa trên tên gốc và các giá trị thuộc tính
      const nameParts = [baseName];

      for (const attrValue of attributeValues) {
        // Sử dụng nameTemplate nếu có, nếu không thì dùng name
        const nameToAdd = attrValue.nameTemplate || attrValue.name;

        // Chỉ thêm phần tên nếu nó không rỗng
        if (nameToAdd && nameToAdd.trim()) {
          nameParts.push(nameToAdd.trim());
        }
      }

      // Kết hợp các phần tên với ký tự phân tách và trả về
      return nameParts.join(separator);
    } catch (error) {
      console.error('Lỗi khi tạo tên sản phẩm:', error);
      throw error;
    }
  }

  /**
   * Tạo tên sản phẩm dựa trên tổ hợp thuộc tính (dành cho biến thể)
   * @param {string} baseName - Tên gốc của sản phẩm
   * @param {Object} attributesCombination - Đối tượng với các cặp attributeGroupId: attributeValueId
   * @param {string} separator - Ký tự phân tách giữa các phần của tên
   * @returns {Promise<string>} Tên sản phẩm được tạo
   */
  async generateVariantName(
    baseName,
    attributesCombination = {},
    separator = ' ',
  ) {
    try {
      // Lấy mảng các ID giá trị thuộc tính đã chọn từ đối tượng tổ hợp
      // Chỉ lấy các giá trị không rỗng
      // Ví dụ: { "color": "redId", "size": "MId" } => ["redId", "MId"]
      const selectedAttributeIds = Object.values(attributesCombination).filter(
        (id) => id,
      );

      return this.generateProductName(
        baseName,
        selectedAttributeIds,
        separator,
      );
    } catch (error) {
      console.error('Lỗi khi tạo tên biến thể:', error);
      throw error;
    }
  }

  /**
   * Xem trước tên sản phẩm mà không lưu thay đổi
   * @param {string} baseName - Tên gốc của sản phẩm
   * @param {Array} selectedAttributes - Mảng các ID giá trị thuộc tính đã chọn
   * @param {Object} options - Options cho việc tạo tên
   * @returns {Promise<Object>} Kết quả xem trước với tên gốc và tên đã tạo
   */
  async previewProductName(baseName, selectedAttributes = [], options = {}) {
    try {
      const { separator = ' ', includeDetails = false } = options;

      // Tạo tên sản phẩm dựa trên các tham số đã cho
      const generatedName = await this.generateProductName(
        baseName,
        selectedAttributes,
        separator,
      );

      // Chuẩn bị kết quả trả về
      const result = {
        originalName: baseName,
        generatedName,
        hasChanges: generatedName !== baseName,
        parts: generatedName.split(separator),
      };

      if (includeDetails) {
        // Lấy thông tin chi tiết về các thuộc tính đã chọn có ảnh hưởng đến tên
        const attributeValues = await AttributeValue.findAll({
          where: {
            id: selectedAttributes,
            affectsName: true,
            isActive: true,
          },
          include: [
            {
              model: AttributeGroup,
              as: 'attributeGroup',
              attributes: ['id', 'name', 'type'],
            },
          ],
        });

        // Đính kèm thông tin chi tiết vào kết quả
        result.affectingAttributes = attributeValues.map((attr) => ({
          id: attr.id,
          name: attr.name,
          nameTemplate: attr.nameTemplate,
          groupName: attr.attributeGroup?.name,
          groupType: attr.attributeGroup?.type,
        }));
      }

      return result;
    } catch (error) {
      console.error('Lỗi khi xem trước tên sản phẩm:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả các giá trị thuộc tính có thể ảnh hưởng đến tên sản phẩm
   * @param {string} productId - ID sản phẩm (optional, dành cho thuộc tính riêng của sản phẩm)
   * @returns {Promise<Array>} Mảng các giá trị thuộc tính ảnh hưởng đến tên
   */
  async getNameAffectingAttributes(productId = null) {
    try {
      const whereCondition = {
        affectsName: true,
        isActive: true,
      };

      const attributeValues = await AttributeValue.findAll({
        where: whereCondition,
        include: [
          {
            model: AttributeGroup,
            as: 'attributeGroup',
            attributes: ['id', 'name', 'type', 'description'],
            where: { isActive: true },
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      return attributeValues;
    } catch (error) {
      console.error('Lỗi khi lấy các thuộc tính ảnh hưởng đến tên:', error);
      throw error;
    }
  }

  /**
   * Tạo tên hàng loạt cho nhiều sản phẩm/biến thể
   * @param {Array} items - Mảng các item với baseName và selectedAttributes
   * @param {string} separator - Ký tự phân tách giữa các phần của tên
   * @returns {Promise<Array>} Mảng các tên đã được tạo
   */
  async batchGenerateNames(items = [], separator = ' ') {
    try {
      const results = [];

      for (const item of items) {
        const { baseName, selectedAttributes, id } = item;

        const generatedName = await this.generateProductName(
          baseName,
          selectedAttributes,
          separator,
        );

        results.push({
          id,
          baseName,
          generatedName,
          selectedAttributes,
        });
      }

      return results;
    } catch (error) {
      console.error('Lỗi khi tạo tên hàng loạt:', error);
      throw error;
    }
  }
}

module.exports = new ProductNameGeneratorService();
