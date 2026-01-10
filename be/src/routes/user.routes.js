const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  updateUserSchema,
  changePasswordSchema,
} = require('../validators/user.validator');
const { addressSchema } = require('../validators/address.validator');
const { authenticate } = require('../middlewares/authenticate');

// TẤT CẢ CÁC ROUTE ĐỀU YÊU CẦU XÁC THỰC
router.use(authenticate);

// PROFILE ROUTES

router.put(
  '/profile', // PUT /api/users/profile - Cập nhật thông tin cá nhân
  validateRequest(updateUserSchema),
  userController.updateProfile,
);
router.post(
  '/change-password', // POST /api/users/change-password - Đổi mật khẩu
  validateRequest(changePasswordSchema),
  userController.changePassword,
);

// ADDRESS ROUTES

router.get(
  '/addresses', // GET /api/users/addresses - Lấy danh sách địa chỉ
  userController.getAddresses,
);
router.post(
  '/addresses', // POST /api/users/addresses - Thêm địa chỉ mới
  validateRequest(addressSchema),
  userController.addAddress,
);
router.put(
  '/addresses/:id', // PUT /api/users/addresses/:id - Cập nhật địa chỉ
  validateRequest(addressSchema),
  userController.updateAddress,
);
router.delete(
  '/addresses/:id', // DELETE /api/users/addresses/:id - Xóa địa chỉ
  userController.deleteAddress,
);
router.patch(
  '/addresses/:id/default', // PATCH /api/users/addresses/:id/default - Đặt địa chỉ mặc định
  userController.setDefaultAddress,
);

module.exports = router;
