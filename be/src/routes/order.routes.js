const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createOrderSchema,
  updateOrderStatusSchema,
} = require('../validators/order.validator');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// USER ROUTES (AUTHENTICATED)

router.use(authenticate);

router.post(
  '/', // POST /api/orders - Tạo đơn hàng mới
  validateRequest(createOrderSchema),
  orderController.createOrder,
);
router.get(
  '/', // GET /api/orders - Lấy danh sách đơn hàng của người dùng
  orderController.getUserOrders,
);
router.get(
  '/number/:number', // GET /api/orders/number/:number - Lấy chi tiết đơn hàng theo số đơn hàng
  orderController.getOrderByNumber,
);
router.get(
  '/:id', // GET /api/orders/:id - Lấy chi tiết đơn hàng theo ID
  orderController.getOrderById,
);
router.post(
  '/:id/cancel', // POST /api/orders/:id/cancel - Hủy đơn hàng
  orderController.cancelOrder,
);
router.post(
  '/:id/repay', // POST /api/orders/:id/repay - Thanh toán lại đơn hàng
  orderController.repayOrder,
);

// ADMIN ROUTES

router.get(
  '/admin/all', // GET /api/orders/admin/all - Lấy tất cả đơn hàng (Admin)
  authorize('admin'),
  orderController.getAllOrders,
);

router.patch(
  '/admin/:id/status', // PATCH /api/orders/admin/:id/status - Cập nhật trạng thái đơn hàng (Admin)
  authorize('admin'),
  validateRequest(updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

module.exports = router;
