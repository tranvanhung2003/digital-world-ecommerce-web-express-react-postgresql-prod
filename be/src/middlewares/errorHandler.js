/**
 * Custom AppError class để định nghĩa lỗi ứng dụng
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Trình xử lý lỗi Development - gửi thông tin lỗi chi tiết
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

/**
 * Trình xử lý lỗi Production - gửi thông tin lỗi một cách hạn chế
 */
const sendErrorProd = (err, res) => {
  // Nếu là lỗi vận hành, đáng tin cậy: gửi message cho client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Nếu là lỗi lập trình hoặc lỗi không xác định khác: không tiết lộ chi tiết lỗi
    console.error('ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
    });
  }
};

/**
 * Xử lý các loại lỗi cụ thể
 */

/**
 * Xử lý lỗi CastError của database
 */
const handleCastErrorDB = (err) => {
  const message = `Giá trị không hợp lệ: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Xử lý lỗi trùng lặp trường trong database
 */
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Giá trị trùng lặp: ${value}. Vui lòng sử dụng giá trị khác!`;
  return new AppError(message, 400);
};

/**
 * Xử lý lỗi ValidationError của database
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Dữ liệu không hợp lệ. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Xử lý lỗi JWT không hợp lệ
 */
const handleJWTError = () =>
  new AppError('Token không hợp lệ. Vui lòng đăng nhập lại!', 401);

/**
 * Xử lý lỗi JWT hết hạn
 */
const handleJWTExpiredError = () =>
  new AppError('Token đã hết hạn. Vui lòng đăng nhập lại!', 401);

/**
 * Xử lý lỗi Sequelize unique constraint error
 */
const handleSequelizeUniqueConstraintError = (err) => {
  // Trích xuất field name và value từ lỗi
  const field = err.errors[0]?.path;
  const value = err.errors[0]?.value;
  const message = `Giá trị '${value}' đã tồn tại cho trường '${field}'. Vui lòng sử dụng giá trị khác!`;

  return new AppError(message, 400);
};

/**
 * Middleware xử lý lỗi toàn cục
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    // Nếu ở môi trường development, gửi lỗi chi tiết
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    // Nếu ở môi trường production, xử lý lỗi cụ thể và gửi lỗi một cách hạn chế
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);

    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);

    if (error.name === 'JsonWebTokenError') error = handleJWTError();

    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    if (error.name === 'SequelizeUniqueConstraintError')
      error = handleSequelizeUniqueConstraintError(error);

    sendErrorProd(error, res);
  }
};

module.exports = {
  AppError,
  errorHandler,
};
