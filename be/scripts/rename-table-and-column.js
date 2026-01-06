/**
 * Đổi tên toàn bộ bảng và cột trong cơ sở dữ liệu.
 */

const { sequelize } = require('../src/models');

async function renameTableAndColumn() {
  // Thứ tự các bảng là quan trọng để tránh vi phạm ràng buộc khóa ngoại.
  // Thứ tự các bảng: bảng cha trước, bảng con sau.
  const RENAME_MAPS = [
    {
      oldTableName: 'old_table_1',
      newTableName: 'new_table_1',
      columns: [
        { oldColumnName: 'old_column_1', newColumnName: 'new_column_1' },
        { oldColumnName: 'old_column_2', newColumnName: 'new_column_2' },
      ],
    },
    {
      oldTableName: 'old_table_2',
      newTableName: 'new_table_2',
      columns: [
        { oldColumnName: 'old_column_a', newColumnName: 'new_column_a' },
        { oldColumnName: 'old_column_b', newColumnName: 'new_column_b' },
      ],
    },
  ];

  const transaction = await sequelize.transaction();
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Bắt đầu đổi tên toàn bộ bảng và cột...');

    for (const map of RENAME_MAPS) {
      const { oldTableName, newTableName, columns } = map;

      await queryInterface.renameTable(oldTableName, newTableName, {
        transaction,
      });
      console.log(`Đã đổi tên bảng từ ${oldTableName} thành ${newTableName}.`);

      for (const column of columns) {
        const { oldColumnName, newColumnName } = column;

        await queryInterface.renameColumn(
          newTableName,
          oldColumnName,
          newColumnName,
          { transaction },
        );
        console.log(
          `Đã đổi tên cột từ ${oldColumnName} thành ${newColumnName} trong bảng ${newTableName}.`,
        );
      }
    }

    await transaction.commit();
    console.log('Đổi tên toàn bộ bảng và cột thành công.');
  } catch (error) {
    await transaction.rollback();
    console.error('Lỗi trong quá trình đổi tên bảng và cột:', error);
  } finally {
    await sequelize.close();
  }
}

renameTableAndColumn();
