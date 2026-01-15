const { Product, Category, Order, OrderItem, User } = require('../models');
const { Op } = require('sequelize');

class ChatbotService {
  /**
   * Trích xuất các từ khóa tìm kiếm từ ngôn ngữ tự nhiên
   */
  extractSearchParams(message) {
    const lowerMessage = message.toLowerCase();
    const params = {};

    // Tạo keyword mapping cho từng danh mục sản phẩm
    const categoryKeywords = {
      laptop: ['notebook', 'máy tính xách tay', 'macbook', 'ultrabook'],
      'điện thoại': ['smartphone', 'phone', 'iphone', 'samsung', 'xiaomi'],
      'máy tính bảng': ['tablet', 'ipad', 'galaxy tab'],
      'đồng hồ thông minh': ['smartwatch', 'apple watch', 'samsung watch'],
      'âm thanh': ['tai nghe', 'loa', 'headphone', 'earbuds'],
      'máy ảnh': ['camera', 'dslr', 'mirrorless'],
      'linh kiện máy tính': ['ram', 'ssd', 'hdd', 'cpu', 'gpu', 'mainboard'],
      'màn hình': ['monitor', 'screen', 'display'],
      'phụ kiện': ['chuột', 'bàn phím', 'sạc dự phòng', 'webcam'],
      'thiết bị lưu trữ': ['ổ cứng', 'usb', 'external drive'],
      'thiết bị mạng': ['router', 'modem', 'wifi'],
      'điện tử gia dụng': ['smart home', 'iot', 'camera an ninh'],
      'điện tử': ['tv', 'tivi', 'smart tv'],
    };

    // Trích xuất danh mục sản phẩm
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (this.matchesPatterns(lowerMessage, keywords)) {
        params.category = category;

        break;
      }
    }

    // Trích xuất khoảng giá sản phẩm
    const priceMatch = lowerMessage.match(/(\d+)(?:k|000|triệu)?/g);
    if (priceMatch) {
      const prices = priceMatch.map((p) => {
        if (p.includes('k')) return parseInt(p) * 1000;
        if (p.includes('triệu')) return parseInt(p) * 1000000;

        return parseInt(p);
      });

      if (this.matchesPatterns(lowerMessage, ['dưới', 'under'])) {
        params.maxPrice = Math.max(...prices);
      } else if (this.matchesPatterns(lowerMessage, ['trên', 'over'])) {
        params.minPrice = Math.min(...prices);
      }
    }

    // Trích xuất màu sắc
    const colors = ['đỏ', 'xanh', 'đen', 'trắng', 'vàng', 'hồng', 'nâu', 'xám'];
    for (const color of colors) {
      if (lowerMessage.includes(color)) {
        params.color = color;

        break;
      }
    }

    // Trích xuất thương hiệu
    const brands = [
      'apple',
      'samsung',
      'xiaomi',
      'dell',
      'hp',
      'lenovo',
      'asus',
      'acer',
      'sony',
      'lg',
      'canon',
      'nikon',
      'logitech',
      'razer',
      'msi',
      'huawei',
      'oneplus',
      'realme',
      'oppo',
      'vivo',
    ];
    for (const brand of brands) {
      if (lowerMessage.includes(brand)) {
        params.brand = brand;

        break;
      }
    }

    // Trích xuất từ khóa chung
    params.keyword = message;

    return params;
  }

  /**
   * Lấy thông tin người dùng để cá nhân hóa
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Order,
            as: 'orders',
            include: [
              {
                model: OrderItem,
                as: 'items',
                include: [
                  {
                    model: Product,
                    include: [
                      {
                        model: Category,
                        as: 'categories',
                        through: { attributes: [] },
                      },
                    ],
                  },
                ],
              },
            ],
            limit: 10,
            order: [['createdAt', 'DESC']],
          },
        ],
      });

      // Nếu không tìm thấy người dùng, trả về null
      if (!user) return null;

      // Tính toán sở thích người dùng
      const purchaseHistory = []; // Danh sách sản phẩm đã mua
      const categoryPreferences = {}; // Sở thích danh mục sản phẩm mà người dùng thường mua
      const priceRange = { min: Infinity, max: 0 }; // Khoảng giá mua sắm

      user.orders?.forEach((order) => {
        order.items?.forEach((item) => {
          const product = item.product || item.Product;

          if (product) {
            // Theo dõi lịch sử mua hàng
            purchaseHistory.push(product);

            // Theo dõi sở thích danh mục sản phẩm mà người dùng thường mua
            product.categories?.forEach((cat) => {
              categoryPreferences[cat.name] =
                (categoryPreferences[cat.name] || 0) + 1;
            });

            // Theo dõi khoảng giá mua sắm
            if (product.price < priceRange.min) priceRange.min = product.price;
            if (product.price > priceRange.max) priceRange.max = product.price;
          }
        });
      });

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        purchaseHistory,
        categoryPreferences,
        priceRange: priceRange.min === Infinity ? null : priceRange,
        orderCount: user.orders?.length || 0,
        isVip: (user.orders?.length || 0) >= 5,
      };
    } catch (error) {
      console.error('Lỗi khi lấy thông tin người dùng:', error);

      return null;
    }
  }

  /**
   * Lấy đề xuất sản phẩm cá nhân hóa
   */
  async getPersonalizedRecommendations(userId, params = {}) {
    try {
      const { type = 'personal', limit = 5 } = params;
      let products = [];

      if (type === 'personal' && userId) {
        // Lấy thông tin người dùng để cá nhân hóa
        const userProfile = await this.getUserProfile(userId);

        if (userProfile?.categoryPreferences) {
          // Lấy các danh mục ưa thích của người dùng
          const preferredCategories = Object.keys(
            userProfile.categoryPreferences,
          );

          // Lấy các sản phẩm trong các danh mục ưa thích
          products = await Product.findAll({
            where: {
              status: 'active',
              inStock: true,
            },
            include: [
              {
                model: Category,
                as: 'categories',
                where: {
                  name: { [Op.in]: preferredCategories },
                },
                through: { attributes: [] },
              },
            ],
            limit: limit * 2, // Lấy gấp đôi số lượng để lọc sau
            order: [['createdAt', 'DESC']],
          });

          // Lọc bỏ các sản phẩm người dùng đã mua
          const purchasedProductIds = userProfile.purchaseHistory.map(
            (p) => p.id,
          );

          // Lọc bỏ các sản phẩm đã mua, chỉ giữ lại những sản phẩm chưa mua
          products = products.filter(
            (p) => !purchasedProductIds.includes(p.id),
          );
        }
      }

      // Nếu không đủ sản phẩm cá nhân hóa, dự phòng bằng các sản phẩm nổi bật
      if (products.length < limit) {
        const fallbackProducts = await Product.findAll({
          where: {
            status: 'active',
            inStock: true,
            [Op.or]: [
              { featured: true },
              { compareAtPrice: { [Op.gt]: 0 } }, // Sản phẩm có giảm giá
            ],
          },
          limit: limit - products.length, // Chỉ lấy số lượng cần thiết để đủ limit
          order: [
            ['featured', 'DESC'],
            ['createdAt', 'DESC'],
          ],
        });

        // Kết hợp sản phẩm cá nhân hóa và dự phòng
        products = [...products, ...fallbackProducts];
      }

      // Format các sản phẩm để trả về frontend
      return products.slice(0, limit).map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        thumbnail: product.thumbnail,
        inStock: product.inStock,
        rating: 4.5,
        discount: product.compareAtPrice
          ? Math.round(
              ((product.compareAtPrice - product.price) /
                product.compareAtPrice) *
                100,
            )
          : 0,
      }));
    } catch (error) {
      console.error('Lỗi khi lấy đề xuất sản phẩm cá nhân hóa:', error);

      return [];
    }
  }

  /**
   * Theo dõi các sự kiện analytics
   */
  async trackAnalytics(data) {
    try {
      // Trong triển khai thực tế, những dữ liệu này sẽ được lưu vào bảng analytics
      console.log('Dữ liệu analytics:', data);
    } catch (error) {
      console.error('Lỗi khi theo dõi analytics:', error);
    }
  }

  /**
   * Phân tích ý định của người dùng từ tin nhắn
   * Hàm này đang trong quá trình thử nghiệm
   */
  async analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Phân tích ý định tìm kiếm sản phẩm
    const searchProductKeywords = [
      'tìm',
      'kiếm',
      'search',
      'mua',
      'cần',
      'muốn',
      'có',
      'bán',
      'shop',
      'store',
      'sản phẩm',
    ];
    if (this.matchesPatterns(lowerMessage, searchProductKeywords)) {
      return {
        type: 'product_search',
        confidence: 0.8,
        params: this.extractSearchParams(message),
      };
    }

    // Phân tích ý định đề xuất sản phẩm
    const recommendationProductKeywords = [
      'gợi ý',
      'đề xuất',
      'recommend',
      'tư vấn',
      'nên mua',
      'phù hợp',
      'hot',
      'trend',
      'bán chạy',
      'mới',
    ];
    if (this.matchesPatterns(lowerMessage, recommendationProductKeywords)) {
      return {
        type: 'product_recommendation',
        confidence: 0.9,
        params: { type: 'general' },
      };
    }

    // Phân tích ý định về sales pitch (bài thuyết phục bán hàng)
    const salesPitchKeywords = [
      'giá',
      'bao nhiêu',
      'cost',
      'price',
      'tiền',
      'rẻ',
      'đắt',
      'sale',
      'giảm giá',
      'khuyến mãi',
    ];
    if (this.matchesPatterns(lowerMessage, salesPitchKeywords)) {
      return {
        type: 'sales_pitch',
        confidence: 0.9,
        params: { focus: 'pricing' },
      };
    }

    // Phân tích ý định về đơn hàng
    const orderInquiryKeywords = [
      'đơn hàng',
      'order',
      'mua hàng',
      'thanh toán',
      'ship',
      'giao hàng',
      'delivery',
    ];
    if (this.matchesPatterns(lowerMessage, orderInquiryKeywords)) {
      return {
        type: 'order_inquiry',
        confidence: 0.7,
        params: {},
      };
    }

    // Phân tích ý định về hỗ trợ khách hàng
    const supportKeywords = [
      'hỗ trợ',
      'help',
      'support',
      'lỗi',
      'problem',
      'đổi trả',
      'return',
      'refund',
      'bảo hành',
    ];
    if (this.matchesPatterns(lowerMessage, supportKeywords)) {
      return {
        type: 'support',
        confidence: 0.8,
        params: {},
      };
    }

    // Mặc định trả về ý định chung
    return {
      type: 'general',
      confidence: 0.5,
      params: {},
    };
  }

  /**
   * Tạo bài thuyết phục bán hàng dựa trên hồ sơ người dùng và ngữ cảnh cuộc trò chuyện
   * Hàm này đang trong quá trình thử nghiệm
   */
  async generateSalesPitch({
    userProfile,
    message,
    bestDeals,
    trendingProducts,
    context,
  }) {
    try {
      const templates = this.getSalesPitchTemplates();
      const pitchType = this.selectPitchType(userProfile, message, context);

      // Chọn loại bài thuyết phục dựa trên hồ sơ người dùng, tin nhắn và ngữ cảnh
      let pitch = templates[pitchType];
      let products = [];

      switch (pitchType) {
        case 'urgency':
          products = bestDeals.slice(0, 3);
          pitch = pitch.replace('{discount}', products[0]?.discount || '50%');

          break;

        case 'personal':
          products = await this.getPersonalizedRecommendations(
            userProfile?.id,
            { limit: 3 },
          );
          pitch = pitch.replace('{name}', userProfile?.name || 'bạn');

          break;

        case 'social_proof':
          products = trendingProducts.slice(0, 3);

          break;

        case 'value':
          products = bestDeals.slice(0, 3);
          const totalSavings = products.reduce(
            (sum, p) => sum + (p.compareAtPrice - p.price),
            0,
          );

          pitch = pitch.replace('{savings}', this.formatPrice(totalSavings));

          break;

        default:
          products = [
            ...bestDeals.slice(0, 2),
            ...trendingProducts.slice(0, 1),
          ];
      }

      return {
        text: pitch,
        products,
        type: pitchType,
      };
    } catch (error) {
      console.error('Lỗi khi tạo sales pitch:', error);

      return {
        text: '🌟 Chúng tôi có nhiều sản phẩm tuyệt vời đang được khuyến mãi! Bạn có muốn xem không?',
        products: bestDeals.slice(0, 3),
        type: 'fallback',
      };
    }
  }

  /**
   * Tìm cơ hội bán hàng trong cuộc trò chuyện chung chung
   * Hàm này đang trong quá trình thử nghiệm
   */
  async findSalesOpportunity(message, userProfile) {
    const lowerMessage = message.toLowerCase();

    // Tìm từ khóa chỉ ra cơ hội bán hàng tiềm năng
    const salesKeywords = [
      'chán',
      'buồn',
      'stress',
      'mệt',
      'cuối tuần',
      'weekend',
      'rảnh',
      'shopping',
      'mua sắm',
      'tiền',
      'sinh nhật',
      'party',
      'date',
      'work',
      'công việc',
      'interview',
    ];

    const opportunity = this.matchesPatterns(lowerMessage, salesKeywords);

    // Nếu tìm thấy cơ hội, trả về ý định bán hàng với độ tin cậy trung bình
    if (opportunity) {
      return {
        found: true,
        intent: {
          type: 'sales_pitch',
          confidence: 0.7,
          params: { trigger: opportunity },
        },
      };
    }

    return { found: false };
  }

  /**
   * Theo dõi cuộc trò chuyện để phân tích
   * Hàm này đang trong quá trình thử nghiệm
   */
  async trackConversation(data) {
    try {
      // Trong triển khai thực tế, những dữ liệu này sẽ được lưu vào bảng theo dõi cuộc trò chuyện
      console.log('Dữ liệu cuộc trò chuyện:', {
        userId: data.userId,
        message: data.message,
        intent: data.intent,
        products: data.products?.length || 0,
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('Lỗi khi theo dõi cuộc trò chuyện:', error);
    }
  }

  /**
   * Mẫu bài thuyết phục bán hàng
   * Hàm này đang trong quá trình thử nghiệm
   */
  getSalesPitchTemplates() {
    return {
      urgency:
        '⏰ CẢNH BÁO: Chỉ còn vài giờ để nhận ưu đãi {discount}! Đừng bỏ lỡ cơ hội này nhé! 🔥',
      personal:
        'Chào {name}! 😊 Dựa trên sở thích của bạn, tôi có một vài sản phẩm tuyệt vời muốn giới thiệu!',
      social_proof:
        '🌟 Những sản phẩm này đang được rất nhiều khách hàng yêu thích và mua! Bạn cũng thử xem nhé!',
      value:
        '💎 Cơ hội tuyệt vời! Bạn có thể tiết kiệm tới {savings} với các deal hôm nay!',
      scarcity:
        '⚡ Chỉ còn số lượng có hạn! Nhiều khách hàng đang quan tâm đến những sản phẩm này!',
      seasonal:
        '🎉 Ưu đãi đặc biệt mùa này! Đây là thời điểm tốt nhất để shopping đấy!',
    };
  }

  /**
   * Chọn loại bài thuyết phục bán hàng dựa trên hồ sơ người dùng và ngữ cảnh
   * Hàm này đang trong quá trình thử nghiệm
   */
  selectPitchType(userProfile, message, context) {
    const lowerMessage = message.toLowerCase();

    // Nếu người dùng là VIP, ưu tiên bài thuyết phục cá nhân
    if (userProfile?.isVip) return 'personal';

    // Nếu người dùng quan tâm đến giá cả, ưu tiên bài thuyết phục về giá trị
    if (this.matchesPatterns(lowerMessage, ['giá', 'rẻ'])) return 'value';

    // Nếu người dùng đề cập đến xu hướng hoặc sản phẩm hot, ưu tiên bài thuyết phục về bằng chứng xã hội
    if (this.matchesPatterns(lowerMessage, ['hot', 'trend']))
      return 'social_proof';

    // Nếu ngữ cảnh là buổi tối hoặc cuối tuần, ưu tiên bài thuyết phục về sự khẩn cấp
    if (context.timeOfDay === 'evening') return 'urgency';

    // Nếu không có điều kiện đặc biệt, chọn ngẫu nhiên một loại bài thuyết phục
    const types = ['urgency', 'social_proof', 'value', 'scarcity'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Định dạng giá tiền theo định dạng Việt Nam
   */
  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }

  // Helper methods
  matchesPatterns(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }
}

module.exports = new ChatbotService();
