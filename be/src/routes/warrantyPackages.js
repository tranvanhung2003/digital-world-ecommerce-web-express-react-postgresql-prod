const express = require('express');
const {
  getAllWarrantyPackages,
  createWarrantyPackage,
  updateWarrantyPackage,
  deleteWarrantyPackage,
  getWarrantyPackageById,
  getWarrantyPackagesByProduct,
} = require('../controllers/warrantyPackageController');
const { authenticate } = require('../middlewares/authenticate');
const { adminAuthenticate } = require('../middlewares/adminAuth');

const router = express.Router();

// PUBLIC ROUTES

router.get(
  '/', // GET /api/warranty-packages - Lấy tất cả gói bảo hành
  getAllWarrantyPackages,
);
router.get(
  '/product/:productId', // GET /api/warranty-packages/product/:productId - Lấy gói bảo hành theo sản phẩm
  getWarrantyPackagesByProduct,
);
router.get(
  '/:id', // GET /api/warranty-packages/:id - Lấy gói bảo hành theo ID
  getWarrantyPackageById,
);

// ADMIN ROUTES

router.post(
  '/', // POST /api/warranty-packages - Tạo gói bảo hành (Admin)
  adminAuthenticate,
  createWarrantyPackage,
);
router.put(
  '/:id', // PUT /api/warranty-packages/:id - Cập nhật gói bảo hành (Admin)
  adminAuthenticate,
  updateWarrantyPackage,
);
router.delete(
  '/:id', // DELETE /api/warranty-packages/:id - Xóa gói bảo hành (Admin)
  adminAuthenticate,
  deleteWarrantyPackage,
);

module.exports = router;
