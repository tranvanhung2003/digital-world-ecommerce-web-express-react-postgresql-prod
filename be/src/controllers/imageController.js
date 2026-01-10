const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const imageService = require('../services/imageService');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Cấu hình multer để lưu trữ file tạm thời
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Thư mục tạm thời để lưu trữ file trước khi xử lý
    const tempDir = path.join(__dirname, '../../uploads/temp');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Đặt tên file với định dạng: temp_<uuid>.<ext>
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `temp_${uniqueSuffix}${ext}`);
  },
});

/**
 * Lọc file để chỉ chấp nhận các định dạng ảnh
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Chỉ chấp nhận các định dạng ảnh (JPEG, PNG, GIF, WebP)',
        400,
      ),
      false,
    );
  }
};

/**
 * Cấu hình multer với giới hạn kích thước và số lượng file
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Maximum 10 files
  },
});

class ImageController {
  /**
   * Tải lên một ảnh
   */
  async uploadSingle(req, res, next) {
    try {
      // Sử dụng middleware multer để xử lý upload
      const uploadMiddleware = upload.single('image');

      uploadMiddleware(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(
                new AppError('File quá lớn. Kích thước tối đa là 10MB', 400),
              );
            }
            return next(new AppError(`Lỗi tải lên: ${err.message}`, 400));
          }
          return next(err);
        }

        // Kiểm tra nếu không có file được tải lên
        if (!req.file) {
          return next(new AppError('Không có file được tải lên', 400));
        }

        try {
          const options = {
            category: req.body.category || 'product',
            productId: req.body.productId || null,
            userId: req.user?.id || null,
            generateThumbs: req.body.generateThumbs !== 'false',
            optimize: req.body.optimize !== 'false',
          };

          const result = await imageService.uploadImage(req.file, options);

          res.status(200).json({
            status: 'success',
            message: 'Ảnh đã được tải lên thành công',
            data: result,
          });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Tải lên nhiều ảnh
   */
  async uploadMultiple(req, res, next) {
    try {
      // Sử dụng middleware multer để xử lý upload
      const uploadMiddleware = upload.array('images', 10);

      uploadMiddleware(req, res, async (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return next(
                new AppError('File quá lớn. Kích thước tối đa là 10MB', 400),
              );
            }

            if (err.code === 'LIMIT_FILE_COUNT') {
              return next(new AppError('Quá nhiều file. Tối đa là 10', 400));
            }

            return next(new AppError(`Lỗi tải lên: ${err.message}`, 400));
          }

          return next(err);
        }

        if (!req.files || req.files.length === 0) {
          return next(new AppError('Không có file được tải lên', 400));
        }

        try {
          const options = {
            category: req.body.category || 'product',
            productId: req.body.productId || null,
            userId: req.user?.id || null,
            generateThumbs: req.body.generateThumbs !== 'false',
            optimize: req.body.optimize !== 'false',
          };

          const result = await imageService.uploadMultipleImages(
            req.files,
            options,
          );

          res.status(200).json({
            status: 'success',
            message: `${result.count.successful} ảnh đã được tải lên thành công`,
            data: result,
          });
        } catch (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy ảnh theo ID
   */
  async getImageById(req, res, next) {
    try {
      const { id } = req.params;

      // Lấy ảnh theo ID
      const image = await imageService.getImageById(id);

      res.status(200).json({
        status: 'success',
        data: {
          ...image.toJSON(),
          url: `/uploads/${image.filePath}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lấy tất cả ảnh liên quan đến một sản phẩm
   */
  async getImagesByProductId(req, res, next) {
    try {
      const { productId } = req.params;

      // Lấy tất cả ảnh liên quan đến productId
      const images = await imageService.getImagesByProductId(productId);

      // Thêm URL truy cập vào mỗi ảnh
      const imagesWithUrls = images.map((image) => ({
        ...image.toJSON(),
        url: `/uploads/${image.filePath}`,
      }));

      res.status(200).json({
        status: 'success',
        data: {
          images: imagesWithUrls,
          count: images.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xóa một ảnh theo ID
   */
  async deleteImage(req, res, next) {
    try {
      const { id } = req.params;
      await imageService.deleteImage(id);

      res.status(200).json({
        status: 'success',
        message: 'Ảnh đã được xóa thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Chuyển đổi dữ liệu ảnh từ base64 thành file
   */
  async convertBase64(req, res, next) {
    try {
      const { base64Data, category, productId } = req.body;

      // Kiểm tra dữ liệu base64
      if (!base64Data) {
        return next(new AppError('Dữ liệu base64 là bắt buộc', 400));
      }

      const options = {
        category: category || 'product',
        productId: productId || null,
        userId: req.user?.id || null,
      };

      const result = await imageService.convertBase64ToFile(
        base64Data,
        options,
      );

      res.status(200).json({
        status: 'success',
        message: 'Dữ liệu base64 đã được chuyển đổi thành file thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Xóa các file ảnh không liên kết trong hệ thống (orphaned files)
   */
  async cleanupOrphanedFiles(req, res, next) {
    try {
      const result = await imageService.cleanupOrphanedFiles();

      res.status(200).json({
        status: 'success',
        message: 'Các file ảnh không liên kết đã được xóa thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check cho image service
   */
  async healthCheck(req, res, next) {
    try {
      res.status(200).json({
        status: 'success',
        message: 'Image service hoạt động bình thường',
        data: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ImageController();
