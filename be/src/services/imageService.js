const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const Image = require('../models/image');
const { AppError } = require('../middlewares/errorHandler');

class ImageService {
  constructor() {
    // Đường dẫn thư mục upload
    this.uploadDir = path.join(__dirname, '../../uploads');

    // Khởi tạo thư mục upload khi khởi động service
    this.initializeDirectories();
  }

  /**
   * Khởi tạo thư mục upload
   */
  async initializeDirectories() {
    const dirs = [
      path.join(this.uploadDir, 'images/products'),
      path.join(this.uploadDir, 'images/thumbnails'),
      path.join(this.uploadDir, 'images/users'),
      path.join(this.uploadDir, 'images/reviews'),
      path.join(this.uploadDir, 'images/temp'),
    ];

    for (const dir of dirs) {
      try {
        // Tạo thư mục nếu chưa tồn tại
        // recursive: true để tạo cả thư mục cha nếu chưa tồn tại
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Tạo thư mục ${dir} thất bại:`, error);
      }
    }
  }

  /**
   * Tạo đường dẫn tệp theo cấu trúc /images/{category}/{year}/{month}/{fileName}
   */
  generateFilePath(category, fileName) {
    // Lấy ngày hiện tại
    const now = new Date();

    // Lấy năm ở dạng string 4 chữ số
    const year = String(now.getFullYear());

    // Lấy tháng ở dạng string 2 chữ số
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // // Lấy ngày ở dạng string 2 chữ số
    // const day = String(now.getDate()).padStart(2, '0');

    return path.join('images', category, year, month, fileName);
  }

  /**
   * Tạo tên tệp duy nhất với UUID
   */
  generateUniqueFileName(originalName) {
    // Tạo UUID
    const uuid = uuidv4();

    // Lấy phần mở rộng từ tên tệp gốc
    const ext = path.extname(originalName);

    // Trả về tên tệp mới với UUID và phần mở rộng
    return `${uuid}${ext}`;
  }

  /**
   * Lấy kích thước ảnh
   */
  async getImageDimensions(filePath) {
    try {
      // Sử dụng sharp để lấy metadata ảnh
      const metadata = await sharp(filePath).metadata();

      // Trả về kích thước
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      console.error('Lỗi khi lấy kích thước ảnh:', error);

      return { width: null, height: null };
    }
  }

  /**
   * Xử lý và tối ưu ảnh: resize, nén, xoay, sau đó lưu ảnh mới
   */
  async processImage(inputPath, outputPath, options = {}) {
    try {
      // Khởi tạo sharp với tệp đầu vào
      let sharpInstance = sharp(inputPath);

      // Resize ảnh nếu có yêu cầu
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'inside',
          withoutEnlargement: true,
        });
      }

      // Điều chỉnh chất lượng ảnh nếu có yêu cầu
      if (options.quality) {
        if (outputPath.endsWith('.jpg') || outputPath.endsWith('.jpeg')) {
          // Case JPG/JPEG
          sharpInstance = sharpInstance.jpeg({ quality: options.quality });
        } else if (outputPath.endsWith('.png')) {
          // Case PNG
          sharpInstance = sharpInstance.png({ quality: options.quality });
        } else if (outputPath.endsWith('.webp')) {
          // Case WEBP
          sharpInstance = sharpInstance.webp({ quality: options.quality });
        }
      }

      // Tự động xoay ảnh nếu cần thiết, dựa trên dữ liệu EXIF
      // EXIF là dữ liệu kèm theo ảnh, thường được sử dụng để lưu thông tin về hướng chụp ảnh
      // sharp sẽ đọc dữ liệu EXIF và xoay ảnh cho đúng hướng
      sharpInstance = sharpInstance.rotate();

      // Đảm bảo thư mục chứa tệp đầu ra tồn tại
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Lưu ảnh đã xử lý
      await sharpInstance.toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error('Lỗi khi xử lý ảnh:', error);

      throw new AppError('Xử lý ảnh thất bại', 500);
    }
  }

  /**
   * Tạo các ảnh thu nhỏ (thumbnails) với kích thước khác nhau
   */
  async generateThumbnails(originalPath, fileName) {
    const thumbnails = [];

    // Định nghĩa các kích thước thumbnail
    const thumbSizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 },
    ];

    for (const size of thumbSizes) {
      try {
        // Tạo tên tệp thumbnail
        const thumbFileName = `${path.parse(fileName).name}_${size.name}${path.extname(fileName)}`;

        // Tạo đường dẫn tệp thumbnail
        const thumbPath = this.generateFilePath('thumbnails', thumbFileName);

        // Đường dẫn đầy đủ đến tệp thumbnail
        const fullThumbPath = path.join(this.uploadDir, thumbPath);

        // Xử lý và lưu thumbnail
        await this.processImage(originalPath, fullThumbPath, {
          width: size.width,
          height: size.height,
          quality: 85,
          fit: 'cover',
        });

        // Lưu thông tin thumbnail vào mảng kết quả
        thumbnails.push({
          size: size.name,
          path: thumbPath,
          fileName: thumbFileName,
        });
      } catch (error) {
        console.error(`Lỗi khi tạo ${size.name} thumbnail:`, error);
      }
    }

    return thumbnails;
  }

  /**
   * Tải lên và xử lý một ảnh
   */
  async uploadImage(file, options = {}) {
    try {
      console.log('Đang bắt đầu upload ảnh:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        options,
      });

      const {
        category = 'product',
        productId = null,
        userId = null,
        generateThumbs = true,
        optimize = true,
      } = options;

      // Tạo tên tệp duy nhất
      const fileName = this.generateUniqueFileName(file.originalname);

      // Tạo đường dẫn tệp
      const filePath = this.generateFilePath(category, fileName);

      // Đường dẫn đầy đủ đến tệp
      const fullPath = path.join(this.uploadDir, filePath);

      // Đảm bảo thư mục tồn tại
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (optimize) {
        // Nếu có yêu cầu tối ưu ảnh, xử lý ảnh trước khi lưu
        await this.processImage(file.path, fullPath, {
          quality: 90,
        });
      } else {
        // Nếu không có yêu cầu tối ưu, chỉ cần sao chép tệp
        await fs.copyFile(file.path, fullPath);
      }

      // Lấy kích thước ảnh
      const dimensions = await this.getImageDimensions(fullPath);

      // Lưu vào database
      const imageRecord = await Image.create({
        originalName: file.originalname,
        fileName: fileName,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        width: dimensions.width,
        height: dimensions.height,
        category: category,
        productId: productId,
        userId: userId,
      });

      let thumbnails = [];

      // Tạo các thumbnails nếu được yêu cầu và ảnh thuộc category 'product'
      if (generateThumbs && category === 'product') {
        thumbnails = await this.generateThumbnails(fullPath, fileName);
      }

      // Dọn dẹp tệp tạm thời đã upload
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error('Lỗi khi dọn dẹp tệp tạm thời đã upload:', error);
      }

      // Trả về thông tin ảnh đã upload
      return {
        id: imageRecord.id,
        fileName: fileName,
        filePath: filePath,
        url: `/uploads/${filePath}`,
        originalName: file.originalname,
        size: file.size,
        dimensions,
        thumbnails,
        category,
      };
    } catch (error) {
      console.error('Lỗi khi upload ảnh:', error);
      throw new AppError('Upload ảnh thất bại', 500);
    }
  }

  /**
   * Tải lên và xử lý nhiều ảnh
   */
  async uploadMultipleImages(files, options = {}) {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        // Upload từng ảnh một
        const result = await this.uploadImage(file, options);

        // Nếu thành công, thêm vào mảng results
        results.push(result);
      } catch (error) {
        // Nếu có lỗi, thêm vào mảng errors
        errors.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    // Trả về kết quả tổng hợp
    return {
      successful: results,
      failed: errors,
      count: {
        total: files.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  /**
   * Lấy ảnh theo ID
   */
  async getImageById(id) {
    try {
      const image = await Image.findByPk(id);

      if (!image) {
        throw new AppError('Không tìm thấy ảnh', 404);
      }

      return image;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa ảnh
   */
  async deleteImage(id) {
    try {
      // Lấy thông tin ảnh từ database
      const image = await this.getImageById(id);

      // Tạo đường dẫn đầy đủ đến tệp ảnh
      const fullPath = path.join(this.uploadDir, image.filePath);

      try {
        // Xóa tập tin khỏi hệ thống tập tin
        await fs.unlink(fullPath);
      } catch (error) {
        console.error('Lỗi khi xóa tệp:', error);
      }

      // Xóa các ảnh thu nhỏ (thumbnails) nếu có
      if (image.category === 'product') {
        // Xóa các kích thước thumbnail
        const thumbSizes = ['small', 'medium', 'large'];

        for (const size of thumbSizes) {
          try {
            const thumbFileName = `${path.parse(image.fileName).name}_${size}${path.extname(image.fileName)}`;

            // Tạo đường dẫn đầy đủ đến tệp thumbnail
            const thumbPath = path.join(
              this.uploadDir,
              'images/thumbnails',
              thumbFileName,
            );

            // Xóa tệp thumbnail
            await fs.unlink(thumbPath);
          } catch (error) {
            // Bỏ qua nếu có lỗi khi xóa thumbnail
          }
        }
      }

      // Xóa bản ghi ảnh khỏi database
      await image.destroy();

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy ảnh theo productId
   */
  async getImagesByProductId(productId) {
    try {
      // Tìm tất cả ảnh liên quan đến productId
      const images = await Image.findAll({
        where: { productId, isActive: true },
        order: [['createdAt', 'ASC']],
      });

      return images;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Chuyển đổi dữ liệu base64 thành tệp ảnh và lưu vào hệ thống
   */
  async convertBase64ToFile(base64Data, options = {}) {
    try {
      const { category = 'product', productId = null, userId = null } = options;

      // Trích xuất mime type và dữ liệu base64
      // base64Data có định dạng: data:{mimeType};base64,{data}
      // Ví dụ: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      // Kiểm tra định dạng base64 hợp lệ
      if (!matches || matches.length !== 3) {
        throw new AppError('Dữ liệu base64 không hợp lệ', 400);
      }

      // Trích xuất mime type và dữ liệu base64
      const mimeType = matches[1];
      const base64 = matches[2];

      // Lấy phần mở rộng từ mime type
      const ext = mimeType.split('/')[1];

      // Tạo tên tệp duy nhất
      const fileName = `${uuidv4()}.${ext}`;

      // Tạo đường dẫn tệp
      const filePath = this.generateFilePath(category, fileName);

      // Đường dẫn đầy đủ đến tệp
      const fullPath = path.join(this.uploadDir, filePath);

      // Đảm bảo thư mục tồn tại
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Chuyển đổi base64 thành buffer
      const buffer = Buffer.from(base64, 'base64');

      // Ghi buffer vào tệp
      await fs.writeFile(fullPath, buffer);

      // Lấy kích thước ảnh
      const dimensions = await this.getImageDimensions(fullPath);

      // Lưu vào database
      const imageRecord = await Image.create({
        originalName: `converted_${fileName}`,
        fileName: fileName,
        filePath: filePath,
        fileSize: buffer.length,
        mimeType: mimeType,
        width: dimensions.width,
        height: dimensions.height,
        category: category,
        productId: productId,
        userId: userId,
      });

      // Trả về thông tin ảnh đã lưu
      return {
        id: imageRecord.id,
        fileName: fileName,
        filePath: filePath,
        url: `/uploads/${filePath}`,
        originalName: `converted_${fileName}`,
        size: buffer.length,
        dimensions,
        category,
      };
    } catch (error) {
      console.error('Lỗi khi chuyển đổi base64 sang file:', error);
      throw new AppError('Chuyển đổi base64 sang file thất bại', 500);
    }
  }

  /**
   * Dọn dẹp các tệp mồ côi (orphaned files) không còn liên kết với bản ghi ảnh trong database
   */
  async cleanupOrphanedFiles() {
    try {
      // Lấy tất cả tệp trong thư mục upload
      const allFiles = await this.getAllFiles(this.uploadDir);

      // Lấy tất cả ảnh đang hoạt động từ database
      const activeImages = await Image.findAll({
        where: { isActive: true },
        attributes: ['filePath'],
      });

      // Tạo tập hợp các đường dẫn tệp đang hoạt động
      // Sử dụng Set để tối ưu việc tra cứu
      const activeFilePaths = new Set(activeImages.map((img) => img.filePath));

      // Lọc các tệp không có trong tập hợp activeFilePaths (các tệp mồ côi)
      const orphanedFiles = allFiles.filter((filePath) => {
        // Chuyển đổi đường dẫn tệp thành dạng tương đối so với thư mục upload
        const relativePath = path.relative(this.uploadDir, filePath);

        // Kiểm tra nếu tệp không có trong tập hợp activeFilePaths
        // Nếu không có thì là tệp mồ côi
        return !activeFilePaths.has(relativePath);
      });

      // Xóa các tệp mồ côi
      for (const filePath of orphanedFiles) {
        try {
          await fs.unlink(filePath);
          console.log(`Đã xóa tệp mồ côi (orphaned): ${filePath}`);
        } catch (error) {
          console.error(
            `Lỗi khi xóa tệp mồ côi (orphaned) ${filePath}:`,
            error,
          );
        }
      }

      return {
        totalFiles: allFiles.length,
        activeFiles: activeImages.length,
        orphanedFiles: orphanedFiles.length,
        deletedFiles: orphanedFiles.length,
      };
    } catch (error) {
      console.error('Lỗi khi dọn dẹp các tệp mồ côi (orphaned):', error);
      throw new AppError('Dọn dẹp các tệp mồ côi (orphaned) thất bại', 500);
    }
  }

  /**
   * Helper method: đệ quy để lấy tất cả tệp trong một thư mục và các thư mục con
   */
  async getAllFiles(dirPath) {
    const files = [];

    // Đọc nội dung thư mục với tùy chọn withFileTypes để biết được item là tệp hay thư mục
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    // Duyệt qua từng item trong thư mục
    for (const item of items) {
      // Tạo đường dẫn đầy đủ đến item
      const fullPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        // Case item là thư mục, đệ quy để lấy tất cả tệp bên trong
        const subFiles = await this.getAllFiles(fullPath);

        // Thêm các tệp con vào mảng files
        files.push(...subFiles);
      } else {
        // Case item là tệp, thêm vào mảng files
        files.push(fullPath);
      }
    }

    return files;
  }
}

module.exports = new ImageService();
