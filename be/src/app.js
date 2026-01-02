const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const path = require('path');

// Khởi tạo app
const app = express();

// // Tin tưởng các header của reverse proxy khi chạy phía sau Nginx/PM2
// if (process.env.NODE_ENV === 'production') {
//   app.set('trust proxy', 1);
// }

// // Set các header bảo mật HTTP
// app.use(
//   helmet({
//     crossOriginResourcePolicy: { policy: 'cross-origin' },
//     crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
//   }),
// );

// Kích hoạt CORS
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
};

// Kiểm tra xem CORS origin có được đặt thành wildcard trong biến môi trường hay không
if (process.env.CORS_ORIGIN === '*') {
  corsOptions.origin = '*';
} else if (process.env.CORS_ORIGIN) {
  // Nếu được cung cấp, phân tích các origins phân tách bằng dấu phẩy
  const origins = process.env.CORS_ORIGIN.split(',').map((origin) =>
    origin.trim(),
  );

  corsOptions.origin = origins;
} else {
  // Sử dụng các giá trị mặc định dựa trên môi trường chạy
  corsOptions.origin =
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || 'https://tranvanhung2003.id.vn'
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
        ];
}

// Áp dụng middleware CORS với các tùy chọn đã cấu hình
app.use(cors(corsOptions));

// Xử lý các request thăm dò
app.options('*', cors());

// // Ghi log các request trong môi trường development
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// // Giới hạn số lượng request từ cùng một địa chỉ IP (chỉ trong môi trường production)
// if (process.env.NODE_ENV === 'production') {
//   const limiter = rateLimit({
//     max: 100, // giới hạn mỗi IP tối đa 100 request mỗi windowMs
//     windowMs: 15 * 60 * 1000, // 15 phút
//     message:
//       'Quá nhiều request từ địa chỉ IP này, vui lòng thử lại sau 15 phút!',
//   });
//   app.use('/api', limiter);
// }

// Body parser, đọc dữ liệu từ body vào req.body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// // Đã comment để cho phép HTML trong phần nội dung Tin tức
// // Sanitize dữ liệu đầu vào để ngăn chặn các cuộc tấn công XSS
// app.use(xss());

// Compression middleware để nén các response bodies
// Điều này giúp giảm kích thước dữ liệu truyền qua mạng, cải thiện hiệu suất tải trang
app.use(compression());

// Phục vụ các tệp đã tải lên một cách tĩnh từ thư mục 'uploads'
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api', routes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Xử lý 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Không tìm thấy đường dẫn: ${req.originalUrl}`,
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
