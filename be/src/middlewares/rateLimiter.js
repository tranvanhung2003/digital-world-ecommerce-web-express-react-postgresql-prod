const rateLimit = require('express-rate-limit');

/**
 * General API giới hạn tốc độ request từ cùng một địa chỉ IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn mỗi IP tối đa 100 request mỗi windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều request, vui lòng thử lại sau.',
  },
});

/**
 * Giới hạn tốc độ request cho các endpoint xác thực như đăng nhập, đăng ký
 */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 tiếng
  max: 10, // Giới hạn mỗi IP tối đa 10 request mỗi windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};
