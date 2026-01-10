const { NewsletterSubscriber, Feedback } = require('../models');
const { catchAsync } = require('../utils/catchAsync');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Đăng ký nhận bản tin
 */
const subscribeNewsletter = catchAsync(async (req, res) => {
  const { email } = req.body;

  // Nếu không có email thì báo lỗi
  if (!email) {
    throw new AppError('Email là bắt buộc', 400);
  }

  // Tìm hoặc tạo người đăng ký
  const [subscriber, created] = await NewsletterSubscriber.findOrCreate({
    where: { email },
    defaults: { status: 'active' },
  });

  // Nếu người dùng đã đăng ký và trạng thái là active
  if (!created && subscriber.status === 'active') {
    return res.status(200).json({
      status: 'success',
      message: 'Bạn đã đăng ký nhận bản tin của chúng tôi.',
    });
  }

  // Nếu người dùng đã từng hủy đăng ký, cập nhật trạng thái lại thành active
  if (subscriber.status === 'unsubscribed') {
    subscriber.status = 'active';

    // Lưu thay đổi
    await subscriber.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'Cảm ơn bạn đã đăng ký nhận bản tin của chúng tôi!',
  });
});

/**
 * Gửi phản hồi
 */
const sendFeedback = catchAsync(async (req, res) => {
  const { name, email, phone, subject, content } = req.body;

  if (!name || !email || !subject || !content) {
    throw new AppError(
      'Vui lòng cung cấp đầy đủ các trường bắt buộc (tên, email, chủ đề, nội dung)',
      400,
    );
  }

  const feedback = await Feedback.create({
    name,
    email,
    phone,
    subject,
    content,
    status: 'pending',
  });

  res.status(201).json({
    status: 'success',
    message: 'Cảm ơn bạn đã gửi phản hồi. Chúng tôi sẽ xem xét sớm!',
    data: feedback,
  });
});

module.exports = {
  subscribeNewsletter,
  sendFeedback,
};
