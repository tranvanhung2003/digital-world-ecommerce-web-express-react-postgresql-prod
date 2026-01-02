require('dotenv').config();
const app = require('./app');
const sequelize = require('./config/sequelize');
const logger = require('./utils/logger');

/**
 * Kiểm tra kết nối tới database và đồng bộ hóa các model
 */
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Kết nối tới database đã được thiết lập thành công.');

    // Load các model và các relationships giữa các model
    require('./models');
    logger.info('Các model của Sequelize đã được load thành công.');

    // Đồng bộ hóa các model với database
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DB_SYNC === 'true'
    ) {
      // Sử dụng `alter: true` thay vì `force: true` để bảo toàn dữ liệu
      // `force: true` sẽ drop và tạo lại toàn bộ các bảng (xóa tất cả dữ liệu)
      // `alter: true` sẽ modify các bảng hiện có để khớp với các model
      await sequelize.sync({ alter: true });
      logger.info(
        'Các bảng trong cơ sở dữ liệu đã được đồng bộ hóa thành công (bảo toàn dữ liệu).',
      );
    }
  } catch (error) {
    logger.error('Không thể kết nối tới database:', error);
    logger.error('Chi tiết lỗi:', error.message);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

/**
 * Khởi động server và thiết lập các xử lý lỗi toàn cục
 */
const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 8888;
  const server = app.listen(PORT, () => {
    logger.info(
      `Server đang chạy ở chế độ ${process.env.NODE_ENV} và ở trên cổng ${PORT}`,
    );
  });

  // Xử lý uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Đang shutdown...');
    logger.error(err.name, err.message);
    logger.error(err.stack);
    process.exit(1);
  });

  // Xử lý unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Đang shutdown...');
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  // Xử lý SIGTERM signal
  process.on('SIGTERM', () => {
    logger.info('SIGTERM RECEIVED. Đang shutdown một cách nhẹ nhàng');
    server.close(() => {
      logger.info('Process terminated!');
    });
  });
};

startServer();
