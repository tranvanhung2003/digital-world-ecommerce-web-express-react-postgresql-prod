const { User } = require('../src/models');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  try {
    const adminUserData = {
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
      where: { email: adminUserData.email },
    });

    if (existingAdmin) {
      console.log('Tài khoản admin đã tồn tại');
      console.log(`Email: ${adminUserData.email}`);
      console.log('Mật khẩu: (giữ nguyên mật khẩu hiện tại)');
      process.exit(0);
    }

    // Tạo tài khoản admin mới
    await User.create({
      ...adminUserData,
    });

    console.log('Tạo tài khoản admin thành công');
    console.log(`Email: ${adminUserData.email}`);
    console.log(`Mật khẩu: ${adminUserData.password}`);
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản admin:', error);
    process.exit(1);
  }
}

seed();
