const { User } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

async function seedAdminUser() {
  try {
    console.log('Bắt đầu seed tài khoản admin');

    const adminData = {
      id: uuidv4(),
      email: 'admin@gmail.com',
      password: 'Admin2003.',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isEmailVerified: true,
      isActive: true,
    };

    // Kiểm tra xem tài khoản admin đã tồn tại chưa
    const existingAdmin = await User.findOne({
      where: { email: adminData.email },
    });

    if (existingAdmin) {
      console.log('Tài khoản admin đã tồn tại');
      console.log(`Email: ${adminData.email}`);
      console.log('Mật khẩu: (giữ nguyên mật khẩu hiện tại)');

      return;
    }

    // Tạo tài khoản admin mới
    await User.create({
      ...adminData,
    });

    console.log('Tạo tài khoản admin thành công');
    console.log(`Email: ${adminData.email}`);
    console.log(`Mật khẩu: ${adminData.password}`);
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản admin:', error);
  } finally {
    process.exit(0);
  }
}

seedAdminUser();
