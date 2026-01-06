const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('./errorHandler');

/**
 * Middleware để xác thực người dùng
 */
const authenticate = async (req, res, next) => {
  try {
    // Lấy token từ header 'Authorization'
    // Định dạng: Bearer <token>
    const authHeader = req.headers.authorization;

    // Kiểm tra sự tồn tại của token và định dạng đúng (Bearer <token>)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
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

    // Kiểm tra xem user có bị khóa không
    if (!user.isActive) {
      return next(
        new AppError(
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
          401,
        ),
      );
    }

    // Kiểm tra xem email đã được xác minh chưa
    if (!user.isEmailVerified) {
      return next(
        new AppError('Vui lòng xác thực email trước khi tiếp tục', 401),
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
      return next(
        new AppError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại', 401),
      );
    }

    // Nếu lỗi khác, chuyển tiếp lỗi
    next(error);
  }
};

/**
 * Middleware để xác thực người dùng và guest (khách vãng lai) cho chức năng giỏ hàng
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    // Lấy token từ header 'Authorization'
    // Định dạng: Bearer <token>
    const authHeader = req.headers.authorization;

    // Kiểm tra sự tồn tại của token và định dạng đúng (Bearer <token>)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Nếu không có token, tiếp tục với tư cách guest (khách vãng lai)
      return next();
    }

    // Trích xuất token
    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm user theo ID user từ token
    const user = await User.findByPk(decoded.id);

    // Kiểm tra sự tồn tại của user
    if (!user) {
      // Nếu user không tồn tại, tiếp tục với tư cách guest (khách vãng lai)
      return next();
    }

    // Kiểm tra xem user có bị khóa không
    // Nếu có, trả về lỗi thay vì tiếp tục với tư cách guest (khách vãng lai)
    if (!user.isActive) {
      return next(
        new AppError(
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
          401,
        ),
      );
    }

    // Kiểm tra xem email đã được xác minh chưa
    if (!user.isEmailVerified) {
      return next(
        new AppError('Vui lòng xác thực email trước khi tiếp tục', 401),
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
      // Nếu token không hợp lệ hoặc đã hết hạn, tiếp tục với tư cách guest (khách vãng lai)
      return next();
    }

    // Nếu lỗi khác, chuyển tiếp lỗi
    next(error);
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
};
