const { WarrantyPackage } = require('../src/models');

const SEED_WARRANTY_PACKAGES = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Bảo hành cơ bản',
    description: 'Bảo hành miễn phí 12 tháng cho lỗi nhà sản xuất',
    durationMonths: 12,
    price: 0,
    terms: {
      coverage: ['Lỗi nhà sản xuất', 'Hỏng hóc do chất lượng'],
      exclusions: ['Hỏng do người dùng', 'Rơi vỡ', 'Vào nước'],
    },
    coverage: ['Lỗi nhà sản xuất', 'Hỏng hóc do chất lượng'],
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Bảo hành mở rộng 24 tháng',
    description: 'Bảo hành 24 tháng với hỗ trợ thay thế nhanh',
    durationMonths: 24,
    price: 500000,
    terms: {
      coverage: [
        'Lỗi nhà sản xuất',
        'Hỏng hóc do chất lượng',
        'Hỗ trợ thay thế',
      ],
      exclusions: ['Hỏng do người dùng', 'Rơi vỡ', 'Vào nước'],
    },
    coverage: ['Lỗi nhà sản xuất', 'Hỏng hóc do chất lượng', 'Hỗ trợ thay thế'],
    isActive: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Bảo hành toàn diện',
    description: 'Bảo hành 36 tháng bao gồm cả tai nạn và rơi vỡ',
    durationMonths: 36,
    price: 1200000,
    terms: {
      coverage: [
        'Lỗi nhà sản xuất',
        'Hỏng hóc do chất lượng',
        'Tai nạn',
        'Rơi vỡ',
      ],
      exclusions: ['Mất cắp', 'Hỏng do thiên tai'],
    },
    coverage: [
      'Lỗi nhà sản xuất',
      'Hỏng hóc do chất lượng',
      'Tai nạn',
      'Rơi vỡ',
    ],
    isActive: true,
    sortOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seed() {
  try {
    for (const warrantyPackage of SEED_WARRANTY_PACKAGES) {
      await WarrantyPackage.findOrCreate({
        where: { id: warrantyPackage.id },
        defaults: warrantyPackage,
      });
    }

    console.log('Seed warranty packages thành công.');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi seed warranty packages:', error);
    process.exit(1);
  }
}

seed();
