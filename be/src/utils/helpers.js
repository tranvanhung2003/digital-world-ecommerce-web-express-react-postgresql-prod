/**
 * Sequelize Metadata Helpers
 */

const getField = (model, attribute) => {
  if (model.rawAttributes && model.rawAttributes[attribute]) {
    return model.rawAttributes[attribute].field || attribute;
  }

  return attribute;
};

module.exports = {
  getField,
};
