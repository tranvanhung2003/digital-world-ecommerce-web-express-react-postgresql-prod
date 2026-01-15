const {
  Product,
  Category,
  Order,
  OrderItem,
  User,
  Cart,
  CartItem,
  sequelize,
} = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Op } = require('sequelize');
const chatbotService = require('../services/chatbot.service');
const geminiChatbotService = require('../services/geminiChatbot.service');
const { getField } = require('../utils/helpers');

// Khởi tạo Gemini AI client
let genAI = null;

try {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'demo-key') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (error) {
  console.log('Google Generative AI không khả dụng, sử dụng phản hồi dự phòng');
}

class ChatbotController {
  /**
   * Xử lý tin nhắn chat bằng trí tuệ nhân tạo
   */
  async handleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;
      console.log('Đã nhận tin nhắn của người dùng:', {
        message,
        userId,
        sessionId,
      });

      // Kiểm tra tin nhắn rỗng
      if (!message?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tin nhắn không được để trống',
        });
      }

      // Sử dụng dịch vụ Gemini AI để xử lý tin nhắn
      const response = await geminiChatbotService.handleMessage(message, {
        userId,
        sessionId,
        ...context,
      });

      // Gửi phản hồi về cho client
      res.json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      console.error('Lỗi chatbot:', error);
      console.error('Lỗi chi tiết:', error.stack);

      res.status(500).json({
        status: 'error',
        message: 'Xử lý tin nhắn thất bại',
        data: {
          response:
            'Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé! 😅',
          suggestions: [
            'Xem tất cả sản phẩm',
            'Chính sách đổi trả',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
        },
      });
    }
  }

  /**
   * Tìm kiếm sản phẩm bằng AI
   */
  async aiProductSearch(req, res) {
    try {
      const { query, userId, limit = 10 } = req.body;

      // Kiểm tra truy vấn tìm kiếm rỗng
      if (!query?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Truy vấn tìm kiếm không được để trống',
        });
      }

      // Trích xuất tham số tìm kiếm từ truy vấn
      const searchParams = chatbotService.extractSearchParams(query);

      // Tìm kiếm sản phẩm
      const products = await this.searchProducts({ ...searchParams, limit });

      res.json({
        status: 'success',
        data: {
          query,
          results: products,
          total: products.length,
        },
      });
    } catch (error) {
      console.error('Lỗi khi tìm kiếm sản phẩm bằng AI:', error);

      res.status(500).json({
        status: 'error',
        message: 'Tìm kiếm thất bại',
      });
    }
  }

  /**
   * Lấy đề xuất được cá nhân hóa
   */
  async getRecommendations(req, res) {
    try {
      const { userId, limit = 5, type = 'personal' } = req.query;

      // Lấy đề xuất
      const recommendations =
        await chatbotService.getPersonalizedRecommendations(userId, {
          type,
          limit: parseInt(limit),
        });

      res.json({
        status: 'success',
        data: {
          recommendations,
          type,
        },
      });
    } catch (error) {
      console.error('Lỗi khi lấy đề xuất:', error);

      res.status(500).json({
        status: 'error',
        message: 'Lấy đề xuất thất bại',
      });
    }
  }

  /**
   * Theo dõi analytics từ chatbot
   */
  async trackAnalytics(req, res) {
    try {
      const { event, userId, sessionId, productId, value, metadata } = req.body;

      // Ghi nhận sự kiện phân tích
      await chatbotService.trackAnalytics({
        event,
        userId,
        sessionId,
        productId,
        value,
        metadata,
        timestamp: new Date(),
      });

      res.json({
        status: 'success',
        message: 'Analytics được theo dõi thành công',
      });
    } catch (error) {
      console.error('Lỗi khi theo dõi analytics:', error);

      res.status(500).json({
        status: 'error',
        message: 'Theo dõi analytics thất bại',
      });
    }
  }

  /**
   * Thêm sản phẩm vào giỏ hàng qua chatbot
   */
  async addToCart(req, res) {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const userId = req.user.id;

      // Lấy hoặc tạo giỏ hàng
      let cart = await Cart.findOne({ where: { userId } });

      // Nếu chưa có giỏ hàng, tạo mới
      if (!cart) {
        cart = await Cart.create({ userId });
      }

      // Thêm sản phẩm vào giỏ hàng
      const cartItem = await CartItem.create({
        cartId: cart.id,
        productId,
        variantId,
        quantity,
      });

      // Theo dõi analytics
      await chatbotService.trackAnalytics({
        event: 'product_added_to_cart',
        userId,
        sessionId,
        productId,
        metadata: { quantity, source: 'chatbot' },
        timestamp: new Date(),
      });

      res.json({
        status: 'success',
        message: 'Thêm sản phẩm vào giỏ hàng thành công',
        data: { cartItem },
      });
    } catch (error) {
      console.error('Lỗi khi thêm sản phẩm vào giỏ hàng:', error);

      res.status(500).json({
        status: 'error',
        message: 'Thêm sản phẩm vào giỏ hàng thất bại',
      });
    }
  }

  /**
   * Helper method tìm kiếm sản phẩm trong cơ sở dữ liệu
   */
  async searchProducts(searchParams) {
    const where = {
      status: 'active',
      inStock: true,
    };

    // Thêm điều kiện tìm kiếm
    if (searchParams.keyword) {
      const keywordMapping = {
        laptop: ['notebook', 'máy tính xách tay', 'macbook', 'ultrabook'],
        'điện thoại': ['smartphone', 'phone', 'iphone', 'samsung', 'xiaomi'],
        'phụ kiện': ['tai nghe', 'chuột', 'bàn phím', 'sạc dự phòng', 'loa'],
        'máy tính bảng': ['tablet', 'ipad', 'galaxy tab'],
        'máy ảnh': ['camera', 'dslr', 'mirrorless'],
        'màn hình': ['monitor', 'screen', 'display'],
        'ổ cứng': ['ssd', 'hdd', 'lưu trữ'],
        ram: ['bộ nhớ', 'memory'],
        'card đồ họa': ['gpu', 'vga', 'graphics card'],
        'bộ vi xử lý': ['cpu', 'processor', 'chip'],
        mainboard: ['bo mạch chủ', 'motherboard', 'board'],
      };

      const originalKeyword = searchParams.keyword.toLowerCase();

      let searchTerms = [originalKeyword];

      // Mở rộng từ khóa dựa trên ánh xạ
      Object.keys(keywordMapping).forEach((viKeyword) => {
        if (originalKeyword.includes(viKeyword)) {
          searchTerms = [...searchTerms, ...keywordMapping[viKeyword]];
        }
      });

      // Tạo điều kiện tìm kiếm cho tất cả các từ khóa
      const searchConditions = [];

      // Tạo điều kiện tìm kiếm cho tất cả các từ khóa
      searchTerms.forEach((term) => {
        searchConditions.push(
          { name: { [Op.iLike]: `%${term}%` } },
          { description: { [Op.iLike]: `%${term}%` } },
        );
      });

      // Sử dụng toán tử OR để tìm kiếm với tất kỳ từ khóa nào khớp
      where[Op.or] = searchConditions;
    }

    if (searchParams.minPrice) {
      where.price = { [Op.gte]: searchParams.minPrice };
    }
    if (searchParams.maxPrice) {
      where.price = { ...where.price, [Op.lte]: searchParams.maxPrice };
    }

    // Lấy sản phẩm theo các điều kiện đã xây dựng
    const products = await Product.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'categories',
          through: { attributes: [] },
        },
      ],
      limit: searchParams.limit || 20,
      order: [['createdAt', 'DESC']],
    });

    return products;
  }

  /**
   * Trình xử lý tin nhắn đơn giản
   */
  async handleSimpleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;

      if (process.env.NODE_ENV !== 'production') {
        console.log('Tin nhắn đơn giản đã nhận:', {
          message,
          userId,
          sessionId,
        });
      }

      // Kiểm tra tin nhắn rỗng
      if (!message?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tin nhắn là bắt buộc',
        });
      }

      // Phản hồi đơn giản
      const response = {
        response: `Chào bạn! Bạn vừa nói: "${message}". Tôi là trợ lý AI của DigitalWorld! 😊`,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
      };

      res.json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      console.error(
        'Lỗi khi xử lý tin nhắn đơn giản thử nghiệm:',
        error.message || error,
      );
      res.status(500).json({
        status: 'error',
        message: 'Xử lý tin nhắn thử nghiệm thất bại',
      });
    }
  }

  /**
   * Xử lý truy vấn tìm kiếm sản phẩm
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleProductSearch(message, intent, userProfile, context) {
    try {
      // Trích xuất tham số tìm kiếm từ ngôn ngữ tự nhiên
      const searchParams = chatbotService.extractSearchParams(message);

      // Lấy sản phẩm từ cơ sở dữ liệu
      const products = await this.searchProducts(searchParams);

      // Tạo phản hồi AI
      const aiResponse = await this.generateAIResponse(
        `Tìm sản phẩm: ${message}`,
        { products, userProfile, searchParams },
      );

      // Tạo đề xuất sản phẩm
      const productCards = products.slice(0, 5).map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        thumbnail: product.thumbnail,
        inStock: product.inStock,
        rating: product.rating || 4.5,
        discount: product.compareAtPrice
          ? Math.round(
              ((product.compareAtPrice - product.price) /
                product.compareAtPrice) *
                100,
            )
          : 0,
      }));

      return {
        response: aiResponse,
        products: productCards,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
        actions:
          products.length > 0
            ? [
                {
                  type: 'view_products',
                  label: `Xem tất cả ${products.length} sản phẩm`,
                  url: `/products?search=${encodeURIComponent(message)}`,
                },
              ]
            : [],
      };
    } catch (error) {
      console.error('Lỗi khi tìm kiếm sản phẩm:', error);

      throw error;
    }
  }

  /**
   * Xử lý các yêu cầu về gợi ý sản phẩm
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleProductRecommendation(message, intent, userProfile, context) {
    try {
      // Lấy gợi ý cá nhân hóa
      const recommendations =
        await chatbotService.getPersonalizedRecommendations(
          userProfile?.id,
          intent.params,
        );

      // Tạo phản hồi AI
      const aiResponse = await this.generateAIResponse(
        `Gợi ý sản phẩm: ${message}`,
        { recommendations, userProfile },
      );

      return {
        response: aiResponse,
        products: recommendations,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
      };
    } catch (error) {
      console.error('Lỗi khi gợi ý sản phẩm:', error);

      throw error;
    }
  }

  /**
   * Xử lý các yêu cầu chào bán sản phẩm
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleSalesPitch(message, intent, userProfile, context) {
    try {
      // Lấy các ưu đãi tốt nhất và sản phẩm thịnh hành
      const bestDeals = await this.getBestDeals();
      const trendingProducts = await this.getTrendingProducts();

      // Cá nhân hóa bài thuyết phục dựa trên hồ sơ người dùng
      const personalizedPitch = await chatbotService.generateSalesPitch({
        userProfile,
        message,
        bestDeals,
        trendingProducts,
        context,
      });

      return {
        response: personalizedPitch.text,
        products: personalizedPitch.products,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
        actions: [
          {
            type: 'urgent_deals',
            label: '🔥 Ưu đai sắp hết hạn - Mua ngay!',
            url: '/deals',
          },
          {
            type: 'bestsellers',
            label: '⭐ Sản phẩm bán chạy nhất',
            url: '/bestsellers',
          },
        ],
      };
    } catch (error) {
      console.error('Lỗi khi chào bán sản phẩm:', error);
      throw error;
    }
  }

  /**
   * Xử lý các yêu cầu về đơn hàng
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleOrderInquiry(message, intent, userProfile, context) {
    try {
      const aiResponse = await this.generateAIResponse(
        `Hỗ trợ đơn hàng: ${message}`,
        { userProfile },
      );

      return {
        response: aiResponse,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
      };
    } catch (error) {
      console.error('Lỗi khi hỗ trợ đơn hàng:', error);

      throw error;
    }
  }

  /**
   * Xử lý các yêu cầu hỗ trợ khách hàng
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleSupport(message, intent, userProfile, context) {
    try {
      const aiResponse = await this.generateAIResponse(
        `Hỗ trợ khách hàng: ${message}`,
        { userProfile },
      );

      return {
        response: aiResponse,
        suggestions: [
          'Xem tất cả sản phẩm',
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
      };
    } catch (error) {
      console.error('Lỗi khi hỗ trợ khách hàng:', error);

      throw error;
    }
  }

  /**
   * Xử lý các cuộc trò chuyện chung chung
   * Hàm này đang trong quá trình thử nghiệm
   */
  async handleGeneral(message, intent, userProfile, context) {
    try {
      // Luôn cố gắng hướng cuộc trò chuyện theo hướng bán hàng

      // Tìm kiếm cơ hội bán hàng trong tin nhắn
      const salesOpportunity = await chatbotService.findSalesOpportunity(
        message,
        userProfile,
      );

      let response;

      // Nếu có cơ hội bán hàng, thì chào bán sản phẩm
      if (salesOpportunity.found) {
        response = await this.handleSalesPitch(
          message,
          salesOpportunity.intent,
          userProfile,
          context,
        );
      } else {
        // Ngược lại, tạo phản hồi chung chung
        const aiResponse = await this.generateAIResponse(message, {
          userProfile,
        });

        response = {
          response: aiResponse,
          suggestions: [
            'Xem tất cả sản phẩm',
            'Chính sách đổi trả',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
        };
      }

      return response;
    } catch (error) {
      console.error('Lỗi khi xử lý cuộc trò chuyện chung chung:', error);
      throw error;
    }
  }

  /**
   * Lấy các sản phẩm có ưu đãi tốt nhất
   * Hàm này đang trong quá trình thử nghiệm
   */
  async getBestDeals() {
    const Product_compareAtPrice = getField(Product, 'compareAtPrice');
    const Product_price = getField(Product, 'price');

    return await Product.findAll({
      where: {
        status: 'active',
        inStock: true,
        compareAtPrice: { [Op.gt]: 0 },
      },
      order: [
        [
          // Sắp xếp theo tỷ lệ chiết khấu
          sequelize.literal(
            `((${Product_compareAtPrice} - ${Product_price}) / ${Product_compareAtPrice}) DESC`,
          ),
        ],
      ],
      limit: 10,
    });
  }

  /**
   * Lấy các sản phẩm thịnh hành
   * Hàm này đang trong quá trình thử nghiệm
   */
  async getTrendingProducts() {
    return await Product.findAll({
      where: {
        status: 'active',
        inStock: true,
        featured: true,
      },
      limit: 10,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Tạo phản hồi AI từ Gemini AI
   * Hàm này đang trong quá trình thử nghiệm
   */
  async generateAIResponse(prompt, context = {}) {
    try {
      if (!genAI) {
        // Dự phòng phản hồi mẫu nếu không có sẵn AI
        return this.getTemplateResponse(prompt, context);
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });

      const enhancedPrompt = `
Bạn là trợ lý bán hàng thông minh của DigitalWorld - một cửa hàng thiết bị điện tử trực tuyến.
Mục tiêu chính của bạn là giúp khách hàng tìm và mua sản phẩm phù hợp.
        
Ngữ cảnh: ${JSON.stringify(context)}
Câu hỏi khách hàng: ${prompt}
        
Hãy trả lời một cách:
- Thân thiện và chuyên nghiệp
- Tập trung vào việc bán hàng
- Đề xuất sản phẩm cụ thể khi có thể
- Tạo cảm giác cấp bách để khuyến khích mua hàng
- Sử dụng emoji phù hợp để tạo sự thân thiện
        
Độ dài: Khoảng 2-3 câu, ngắn gọn nhưng hiệu quả.
`;

      // Gọi mô hình để tạo phản hồi
      const result = await model.generateContent(enhancedPrompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Lỗi khi tạo phản hồi AI:', error.message || error);

      return this.getTemplateResponse(prompt, context);
    }
  }

  /**
   * Phản hồi mẫu dự phòng nếu AI không khả dụng
   * Hàm này đang trong quá trình thử nghiệm
   */
  getTemplateResponse(prompt, context) {
    const templates = [
      'Tôi hiểu bạn đang tìm kiếm sản phẩm phù hợp! Để giúp bạn tốt nhất, hãy cho tôi biết thêm chi tiết về sở thích của bạn nhé.',
      'Chào bạn! DigitalWorld có rất nhiều sản phẩm tuyệt vời. Bạn quan tâm đến loại sản phẩm nào nhất?',
      'Cảm ơn bạn đã quan tâm! Tôi sẽ giúp bạn tìm những sản phẩm tốt nhất với giá ưu đãi.',
    ];

    // Random một phản hồi mẫu
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

module.exports = ChatbotController;
