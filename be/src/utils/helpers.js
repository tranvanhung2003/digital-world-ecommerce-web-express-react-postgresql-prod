/**
 * Lấy tên bảng từ mô hình Sequelize
 */
const getTableName = (model) => {
  if (model && model.getTableName) {
    const tableName = model.getTableName();

    if (typeof tableName === 'object' && tableName.tableName) {
      return tableName.tableName;
    }

    return tableName;
  }

  return null;
};

/**
 * Lấy tên trường (field) từ một thuộc tính của mô hình Sequelize
 */
const getField = (model, attribute) => {
  if (model && model.rawAttributes && model.rawAttributes[attribute]) {
    return model.rawAttributes[attribute].field || attribute;
  }

  return attribute;
};

module.exports = {
  getTableName,
  getField,
};
