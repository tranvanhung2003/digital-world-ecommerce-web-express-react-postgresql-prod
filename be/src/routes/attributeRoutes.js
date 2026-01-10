const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// PUBLIC ROUTES (CHO FRONTEND HIỂN THỊ SẢN PHẨM)

// GET /api/attributes/groups - Lấy tất cả các nhóm thuộc tính cùng với các giá trị của chúng
router.get('/groups', attributeController.getAttributeGroups);
// GET /api/attributes/products/:productId/groups - Lấy các nhóm thuộc tính của một sản phẩm cụ thể
router.get(
  '/products/:productId/groups',
  attributeController.getProductAttributeGroups,
);

// CÁC ROUTE TẠO TÊN SẢN PHẨM (PUBLIC CHO FRONTEND SỬ DỤNG)

// POST /api/attributes/preview-name - Xem trước tên sản phẩm với các thuộc tính đã chọn
router.post('/preview-name', attributeController.previewProductName);
// POST /api/attributes/generate-name-realtime - Tạo tên sản phẩm theo thời gian thực dựa trên tên cơ bản và các thuộc tính đã chọn
router.post(
  '/generate-name-realtime',
  attributeController.generateNameRealTime,
);
// GET /api/attributes/name-affecting - Lấy danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm
router.get('/name-affecting', attributeController.getNameAffectingAttributes);

// ADMIN ROUTES (YÊU CẦU XÁC THỰC VÀ VAI TRÒ ADMIN)
router.use(authenticate);
router.use(authorize(['admin']));

// CÁC ROUTE QUẢN LÝ NHÓM THUỘC TÍNH

// POST /api/attributes/groups - Tạo nhóm thuộc tính mới
router.post('/groups', attributeController.createAttributeGroup);
// PUT /api/attributes/groups/:id - Cập nhật nhóm thuộc tính
router.put('/groups/:id', attributeController.updateAttributeGroup);
// DELETE /api/attributes/groups/:id - Xóa nhóm thuộc tính (chuyển trạng thái isActive thành false)
router.delete('/groups/:id', attributeController.deleteAttributeGroup);
// POST /api/attributes/products/:productId/groups/:attributeGroupId - Gán nhóm thuộc tính cho sản phẩm
router.post(
  '/products/:productId/groups/:attributeGroupId',
  attributeController.assignAttributeGroupToProduct,
);

// CÁC ROUTE QUẢN LÝ GIÁ TRỊ THUỘC TÍNH

// POST /api/attributes/groups/:attributeGroupId/values - Thêm giá trị thuộc tính vào nhóm thuộc tính
router.post(
  '/groups/:attributeGroupId/values',
  attributeController.addAttributeValue,
);
// PUT /api/attributes/values/:id - Cập nhật giá trị thuộc tính
router.put('/values/:id', attributeController.updateAttributeValue);
// DELETE /api/attributes/values/:id - Xóa giá trị thuộc tính (chuyển trạng thái isActive thành false)
router.delete('/values/:id', attributeController.deleteAttributeValue);

// CÁC ROUTE TẠO TÊN SẢN PHẨM HÀNG LOẠT (CHỈ DÀNH CHO ADMIN)

// POST /api/attributes/batch-generate-names - Tạo tên sản phẩm hàng loạt dựa trên các mục đã cung cấp
router.post(
  '/batch-generate-names',
  attributeController.batchGenerateProductNames,
);

module.exports = router;
