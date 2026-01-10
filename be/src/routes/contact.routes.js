const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');

// Đăng ký nhận bản tin
router.post(
  '/newsletter', // POST /api/contact/newsletter - Đăng ký nhận bản tin
  contactController.subscribeNewsletter,
);

// Gửi phản hồi
router.post(
  '/feedback', // POST /api/contact/feedback - Gửi phản hồi
  contactController.sendFeedback,
);

module.exports = router;
