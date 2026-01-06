const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('./errorHandler');

/**
 * Middleware xác thực dành riêng cho admin
 * Chỉ admin và manager mới có thể truy cập Admin Panel
 */
const adminAuthenticate = async (req, res, next) => {
  try {
    // Lấy token từ header 'Authorization'
    // Định dạng: Bearer <token>
    const authHeader = req.headers.authorization;

    // Kiểm tra sự tồn tại của token và định dạng đúng (Bearer <token>)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(
        new AppError('Cần token xác thực để truy cập Admin Panel', 401),
      );
    }

    // Trích xuất token
    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm user theo ID user từ token
    const user = await User.findByPk(decoded.id);

    // Kiểm tra sự tồn tại của user
    if (!user) {
      return next(new AppError('Người dùng không tồn tại', 401));
    }

    // Kiểm tra xem user có vai trò admin hoặc manager không
    if (!['admin', 'manager'].includes(user.role)) {
      return next(new AppError('Bạn không có quyền truy cập Admin Panel', 403));
    }

    // Kiểm tra xem email đã được xác minh chưa
    if (!user.isEmailVerified) {
      return next(
        new AppError(
          'Vui lòng xác thực email trước khi truy cập Admin Panel',
          401,
        ),
      );
    }

    // Đặt thông tin user vào req để sử dụng trong các middleware hoặc route handler tiếp theo
    req.user = user;

    next();
  } catch (error) {
    // Xử lý lỗi token không hợp lệ hoặc đã hết hạn
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401));
    }

    // Nếu lỗi khác, chuyển tiếp lỗi
    next(error);
  }
};

/**
 * Middleware phân quyền chi tiết cho admin
 * Chỉ admin mới có thể thực hiện một số hành động nhất định
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
  }

  if (req.user.role !== 'admin') {
    return next(
      new AppError('Chỉ Super Admin mới có thể thực hiện hành động này', 403),
    );
  }

  next();
};

module.exports = {
  adminAuthenticate,
  requireSuperAdmin,
};
