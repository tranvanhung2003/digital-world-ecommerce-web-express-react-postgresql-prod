const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Product, Category, sequelize } = require('../models');
const { Op } = require('sequelize');

class GeminiChatbotService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initializeGemini();
  }

  initializeGemini() {
    try {
      if (
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'demo-key'
      ) {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({
          model: 'gemini-2.5-flash-lite',
        });
        console.info(
          '✅ Gemini AI initialized successfully with model: gemini-2.5-flash-lite',
        );
      } else {
        console.warn('⚠️  Gemini API key not found, using fallback responses');
      }
    } catch (error) {
      console.error(
        '❌ Failed to initialize Gemini AI:',
        error.message || error,
      );
    }
  }

  /**
   * Main chatbot handler with AI intelligence
   */
  async handleMessage(message, context = {}) {
    try {
      // Step 1: Get all available products from database
      const allProducts = await this.getAllProducts();
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📦 Found ${allProducts.length} products in database`);
      }

      // Step 2: Use Gemini AI to understand user intent and find matching products
      const aiResponse = await this.getAIResponse(
        message,
        allProducts,
        context,
      );

      return aiResponse;
    } catch (error) {
      console.error('Gemini chatbot error:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Get AI response using Gemini
   */
  async getAIResponse(userMessage, products, context) {
    if (!this.model) {
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Create a comprehensive prompt for Gemini
      const prompt = this.createPrompt(userMessage, products, context);
      if (process.env.NODE_ENV !== 'production') {
        console.log('🤖 Sending request to Gemini API...');
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Received response from Gemini API');
        console.log('📝 AI Response length:', aiText.length);
      }

      // Parse AI response to extract product recommendations
      const parsedResponse = this.parseAIResponse(aiText, products);

      return parsedResponse;
    } catch (error) {
      console.error('❌ Gemini API error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
      });

      // Check if it's a 404 error specifically
      if (error.message && error.message.includes('404')) {
        console.error(
          '🚨 404 Error - Model not found or API endpoint incorrect',
        );
      }

      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Create comprehensive prompt for Gemini AI
   */
  createPrompt(userMessage, products, context) {
    const productList = products
      .map(
        (p) =>
          `- ${p.name}: ${p.shortDescription} (Giá: ${p.price?.toLocaleString('vi-VN')}đ)`,
      )
      .join('\n');

    return `
Bạn là một trợ lý AI thông minh cho cửa hàng thiết bị điện tử DigitalWorld. Bạn có thể xử lý mọi loại câu hỏi:

KHẢ NĂNG CỦA BẠN:
1. Tìm kiếm và gợi ý sản phẩm
2. Trả lời câu hỏi về chính sách, dịch vụ
3. Hỗ trợ khách hàng với mọi thắc mắc
4. Tư vấn thiết bị điện tử
5. Xử lý khiếu nại và phản hồi
6. Trò chuyện thân thiện, tự nhiên
7. Trả lời câu hỏi kiến thức chung một cách thông minh và hài hước

DANH SÁCH SẢN PHẨM CÓ SẴN:
${productList}

THÔNG TIN CỬA HÀNG:
- Tên: DigitalWorld - Cửa hàng thiết bị điện tử trực tuyến
- Chuyên: Áo thun, giày thể thao, balo, túi xách
- Chính sách: Đổi trả trong 7 ngày, miễn phí vận chuyển đơn >500k
- Thanh toán: COD, chuyển khoản, thẻ tín dụng
- Giao hàng: 1-3 ngày trong nội thành, 3-7 ngày ngoại thành
- Hỗ trợ: 24/7 qua chat, hotline: 1900-xxxx

TIN NHẮN KHÁCH HÀNG: "${userMessage}"
CONTEXT: ${JSON.stringify(context)}

HƯỚNG DẪN TRẢ LỜI:
- Nếu hỏi về SẢN PHẨM: Tìm và gợi ý sản phẩm phù hợp
- Nếu hỏi về GIÁ CẢ: So sánh giá, gợi ý sản phẩm trong tầm giá
- Nếu hỏi về CHÍNH SÁCH: Giải thích rõ ràng về đổi trả, giao hàng
- Nếu hỏi về KÍCH THƯỚC: Tư vấn size, hướng dẫn chọn size
- Nếu KHIẾU NẠI: Thể hiện sự quan tâm, hướng dẫn giải quyết
- Nếu HỎI CHUNG: Trò chuyện thân thiện, hướng về sản phẩm
- Nếu HỎI NGOÀI LĨNH VỰC: Trả lời thông minh, hài hước và thân thiện. Có thể trả lời các câu hỏi kiến thức chung, nhưng sau đó nhẹ nhàng chuyển hướng về shop.

Hãy trả lời theo format JSON sau:
{
  "response": "Câu trả lời chi tiết, thân thiện và hữu ích",
  "matchedProducts": ["tên sản phẩm 1", "tên sản phẩm 2", ...],
  "suggestions": ["gợi ý 1", "gợi ý 2", "gợi ý 3", "gợi ý 4"],
  "intent": "product_search|pricing|policy|support|complaint|general|off_topic"
}

LƯU Ý QUAN TRỌNG:
- Luôn trả lời bằng tiếng Việt tự nhiên
- Sử dụng emoji phù hợp để tạo cảm xúc
- Nếu không biết thông tin cụ thể, hãy thành thật và hướng dẫn liên hệ
- Với câu hỏi ngoài lề, hãy trả lời thông minh, hài hước và thân thiện trước, sau đó mới chuyển hướng về shop
- Thể hiện sự quan tâm và sẵn sàng hỗ trợ
- Đừng từ chối trả lời các câu hỏi kiến thức chung, hãy trả lời một cách thông minh và hài hước
`;
  }

  /**
   * Parse AI response and match with actual products
   */
  parseAIResponse(aiText, products) {
    try {
      // Try to parse JSON response from AI
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Find actual product objects based on AI recommendations
        const matchedProducts = [];
        if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
          parsed.matchedProducts.forEach((productName) => {
            const product = products.find(
              (p) =>
                p.name.toLowerCase().includes(productName.toLowerCase()) ||
                productName.toLowerCase().includes(p.name.toLowerCase()),
            );
            if (product) {
              matchedProducts.push({
                id: product.id,
                name: product.name,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                thumbnail: product.thumbnail,
                inStock: product.inStock,
                rating: 4.5,
              });
            }
          });
        }

        return {
          response:
            parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
          products: matchedProducts,
          suggestions: parsed.suggestions || [
            'Xem tất cả sản phẩm',
            'Sản phẩm khuyến mãi',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
          intent: parsed.intent || 'general',
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error.message || error);
    }

    // Fallback: simple keyword matching
    return this.simpleKeywordMatch(userMessage, products);
  }

  /**
   * Simple keyword matching fallback
   */
  simpleKeywordMatch(userMessage, products) {
    const lowerMessage = userMessage.toLowerCase().trim();
    let matchedProducts = [];
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `🔍 Searching for: "${lowerMessage}" in ${products.length} products`,
      );
    }

    // Extract search terms from user message
    const searchTerms = lowerMessage
      .split(' ')
      .filter((term) => term.length > 1); // Reduced from 2 to 1 to catch single-char terms
    searchTerms.push(lowerMessage); // Add full message

    // Add Vietnamese-English keyword mapping
    const keywordMapping = {
      balo: ['balo', 'backpack', 'bag'],
      túi: ['túi', 'bag', 'backpack'],
      giày: ['giày', 'shoes', 'shoe', 'sneaker'],
      áo: ['áo', 'shirt', 'tshirt', 't-shirt'],
      quần: ['quần', 'pants', 'jeans', 'trousers'],
    };

    // Expand search terms with mappings
    const expandedTerms = [...searchTerms];
    Object.keys(keywordMapping).forEach((viTerm) => {
      if (lowerMessage.includes(viTerm)) {
        expandedTerms.push(...keywordMapping[viTerm]);
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 Expanded search terms:`, expandedTerms);
    }

    // Search through products using their dynamic keywords
    products.forEach((product) => {
      let matchScore = 0;
      const productName = product.name?.toLowerCase() || '';
      const productDesc = product.shortDescription?.toLowerCase() || '';
      const productFullDesc = product.description?.toLowerCase() || '';

      // 1. Direct match in product name (highest priority)
      expandedTerms.forEach((term) => {
        if (productName.includes(term.toLowerCase())) {
          matchScore += 10;
          if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ Name match: "${product.name}" contains "${term}"`);
          }
        }
      });

      // 2. Match in short description
      expandedTerms.forEach((term) => {
        if (productDesc.includes(term.toLowerCase())) {
          matchScore += 8;
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `✅ Description match: "${product.name}" desc contains "${term}"`,
            );
          }
        }
      });

      // 3. Match in search keywords (dynamic from database)
      if (product.searchKeywords && Array.isArray(product.searchKeywords)) {
        expandedTerms.forEach((term) => {
          const keywordMatches = product.searchKeywords.filter(
            (keyword) =>
              keyword.toLowerCase().includes(term.toLowerCase()) ||
              term.toLowerCase().includes(keyword.toLowerCase()),
          );
          if (keywordMatches.length > 0) {
            if (process.env.NODE_ENV !== 'production') {
              console.log(
                `✅ Keyword matches for "${product.name}":`,
                keywordMatches,
              );
            }
            matchScore += keywordMatches.length * 5;
          }
        });
      }

      // 4. Partial matches in full product text
      const productText = `${productName} ${productDesc} ${productFullDesc}`;
      expandedTerms.forEach((term) => {
        if (productText.includes(term.toLowerCase())) {
          matchScore += 2;
        }
      });

      // Add product if it has any matches
      if (matchScore > 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `✅ Product "${product.name}" matched with score: ${matchScore}`,
          );
        }
        matchedProducts.push({ ...product, matchScore });
      }
    });

    // Sort by match score (highest first)
    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

    // Remove duplicates
    const uniqueProducts = matchedProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id),
    );

    if (uniqueProducts.length > 0) {
      const productList = uniqueProducts
        .slice(0, 5)
        .map((p) => `• ${p.name} - ${p.price?.toLocaleString('vi-VN')}đ`)
        .join('\n');

      return {
        response: `🔍 Tôi tìm thấy ${uniqueProducts.length} sản phẩm phù hợp với "${userMessage}":\n\n${productList}\n\nBạn muốn xem chi tiết sản phẩm nào không?`,
        products: uniqueProducts.slice(0, 3).map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          rating: 4.5,
        })),
        suggestions: [
          'Xem tất cả sản phẩm',
          'Lọc theo giá',
          'Sản phẩm khuyến mãi',
          'Thêm vào giỏ hàng',
        ],
        intent: 'product_search',
      };
    }

    return this.getFallbackResponse(userMessage);
  }

  /**
   * Get all products from database
   */
  async getAllProducts() {
    try {
      const products = await Product.findAll({
        where: {
          status: 'active',
          inStock: true,
        },
        attributes: [
          'id',
          'name',
          'shortDescription',
          'description',
          'price',
          'compareAtPrice',
          'thumbnail',
          'inStock',
          'searchKeywords',
        ],
        limit: 100, // Limit to avoid too much data
        order: [['createdAt', 'DESC']],
      });

      return products.map((p) => p.toJSON());
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  }

  /**
   * Enhanced fallback response for various scenarios
   */
  getFallbackResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Laptop & Máy tính (Thay thế cho Balo)
    if (
      lowerMessage.includes('laptop') ||
      lowerMessage.includes('máy tính') ||
      lowerMessage.includes('macbook')
    ) {
      return {
        response:
          '💻 Chúng tôi có nhiều dòng Laptop mạnh mẽ! Từ MacBook, Dell XPS đến Laptop Gaming ASUS, MSI... Bạn cần máy cho văn phòng hay đồ họa/chơi game?',
        suggestions: [
          'MacBook mới nhất',
          'Laptop Văn phòng',
          'Laptop Gaming',
          'Xem tất cả máy tính',
        ],
        intent: 'product_search',
      };
    }

    // Điện thoại & Smartphone (Thay thế cho Giày)
    if (
      lowerMessage.includes('điện thoại') ||
      lowerMessage.includes('phone') ||
      lowerMessage.includes('iphone') ||
      lowerMessage.includes('samsung')
    ) {
      return {
        response:
          '📱 Thế giới Smartphone đa dạng tại DigitalWorld! iPhone 15 Pro, Samsung S24 Ultra, Xiaomi... Bạn thích hệ điều hành iOS hay Android?',
        suggestions: [
          'iPhone series',
          'Samsung Galaxy',
          'Điện thoại giá rẻ',
          'Xem tất cả điện thoại',
        ],
        intent: 'product_search',
      };
    }

    // Phụ kiện & Linh kiện (Thay thế cho Áo)
    if (
      lowerMessage.includes('phụ kiện') ||
      lowerMessage.includes('tai nghe') ||
      lowerMessage.includes('chuột') ||
      lowerMessage.includes('bàn phím')
    ) {
      return {
        response:
          '🎧 Phụ kiện công nghệ cực chất! Tai nghe chống ồn Sony, bàn phím cơ Logitech, chuột gaming Razer... Bạn muốn nâng cấp gì cho góc làm việc?',
        suggestions: [
          'Tai nghe Bluetooth',
          'Bàn phím cơ',
          'Chuột không dây',
          'Sạc dự phòng',
        ],
        intent: 'product_search',
      };
    }

    // Pricing inquiries (Cập nhật khoảng giá đồ điện tử)
    if (
      lowerMessage.includes('giá') ||
      lowerMessage.includes('bao nhiêu') ||
      lowerMessage.includes('price')
    ) {
      return {
        response:
          '💰 DigitalWorld có sản phẩm từ phụ kiện 200k đến Laptop cao cấp 60-70 triệu! Bạn đang tìm sản phẩm trong tầm giá nào để tôi tư vấn?',
        suggestions: [
          'Dưới 10 triệu 💸',
          'Từ 10 - 25 triệu 💳',
          'Trên 25 triệu 💎',
          'Săn Deal hot 🎉',
        ],
        intent: 'pricing',
      };
    }

    // Policy inquiries (Cập nhật bảo hành điện tử)
    if (
      lowerMessage.includes('đổi trả') ||
      lowerMessage.includes('bảo hành') ||
      lowerMessage.includes('chính sách')
    ) {
      return {
        response:
          '📋 Chính sách DigitalWorld:\n• Bảo hành chính hãng 12-24 tháng\n• 1 đổi 1 trong 30 ngày nếu lỗi NSX\n• Miễn phí vệ sinh máy trọn đời\n• Hỗ trợ kỹ thuật online 24/7\nBạn cần hỗ trợ thêm về chính sách nào?',
        suggestions: [
          'Kiểm tra bảo hành',
          'Cách thức đổi trả',
          'Trung tâm bảo hành',
          'Gói bảo hành mở rộng',
        ],
        intent: 'policy',
      };
    }

    // Shipping inquiries
    if (
      lowerMessage.includes('giao hàng') ||
      lowerMessage.includes('ship') ||
      lowerMessage.includes('vận chuyển')
    ) {
      return {
        response:
          '🚚 Thông tin giao hàng đồ công nghệ:\n• Giao hỏa tốc 2h (Nội thành)\n• Toàn quốc từ 2-4 ngày\n• Kiểm tra hàng trước khi thanh toán\n• Miễn phí vận chuyển đơn từ 2 triệu\nBạn muốn nhận hàng ở đâu?',
        suggestions: [
          'Giao hàng hỏa tốc',
          'Phí ship toàn quốc',
          'Theo dõi đơn hàng',
          'Thanh toán khi nhận hàng',
        ],
        intent: 'support',
      };
    }

    // Tech Specs inquiries (Thay thế cho Size)
    if (
      lowerMessage.includes('cấu hình') ||
      lowerMessage.includes('thông số') ||
      lowerMessage.includes('ram') ||
      lowerMessage.includes('kích thước')
    ) {
      return {
        response:
          '⚙️ Tư vấn thông số kỹ thuật:\n• Laptop: RAM 8GB/16GB/32GB, Màn 13/14/15.6 inch\n• Điện thoại: Màn hình OLED, Chip xử lý mới nhất\n• Lưu trữ: SSD 256GB đến 2TB\nBạn cần máy cấu hình mạnh để làm việc hay giải trí?',
        suggestions: [
          'Tư vấn RAM & CPU',
          'Kích thước màn hình',
          'Dung lượng bộ nhớ',
          'Chọn máy theo nhu cầu',
        ],
        intent: 'support',
      };
    }

    // Complaint handling
    if (
      lowerMessage.includes('khiếu nại') ||
      lowerMessage.includes('phàn nàn') ||
      lowerMessage.includes('không hài lòng')
    ) {
      return {
        response:
          '😔 DigitalWorld chân thành xin lỗi về sự cố kỹ thuật hoặc dịch vụ khiến bạn không hài lòng! Chúng tôi sẽ ưu tiên giải quyết ngay. Bạn có thể để lại số điện thoại hoặc chi tiết lỗi được không?',
        suggestions: [
          'Gặp kỹ thuật viên',
          'Hotline hỗ trợ gấp',
          'Phản hồi dịch vụ',
          'Yêu cầu bảo hành',
        ],
        intent: 'complaint',
      };
    }

    // Off-topic: Weather
    if (
      lowerMessage.includes('thời tiết') ||
      lowerMessage.includes('weather')
    ) {
      return {
        response:
          '🌤️ Thời tiết này mà ngồi máy lạnh làm việc với một chiếc Laptop mượt mà thì tuyệt nhất! Đừng quên DigitalWorld đang có nhiều mẫu máy chống chói cực tốt đấy!',
        suggestions: [
          'Laptop văn phòng 💻',
          'iPad/Tablet giải trí 📱',
          'Quạt tản nhiệt Laptop 🌬️',
          'Xem khuyến mãi 🎉',
        ],
        intent: 'off_topic',
      };
    }

    // Off-topic: Food
    if (
      lowerMessage.includes('ăn') ||
      lowerMessage.includes('food') ||
      lowerMessage.includes('món')
    ) {
      return {
        response:
          '🍕 Tôi không rành về ẩm thực, nhưng nếu bạn muốn tìm Smartphone camera "khủng" để chụp ảnh món ăn sống ảo hay Tablet để xem công thức nấu ăn thì tôi là chuyên gia đây!',
        suggestions: [
          'Điện thoại chụp ảnh đẹp 📸',
          'Máy tính bảng giá tốt 🍎',
          'Loa nghe nhạc khi nấu ăn 🔊',
          'Ưu đãi hôm nay 🎁',
        ],
        intent: 'off_topic',
      };
    }

    // Chính trị, lịch sử
    if (
      lowerMessage.includes('chính trị') ||
      lowerMessage.includes('lịch sử') ||
      lowerMessage.includes('chiến tranh') ||
      lowerMessage.includes('đảng')
    ) {
      return {
        response:
          '📚 Đây là những chủ đề rất rộng lớn! Tuy nhiên, đam mê lớn nhất của tôi là tư vấn các siêu phẩm công nghệ và giải pháp thiết bị điện tử tại DigitalWorld. Bạn có muốn xem qua những mẫu máy tính mới nhất không? 😊',
        suggestions: [
          'Sản phẩm mới nhất',
          'Cấu hình Laptop mạnh nhất',
          'Khuyến mãi tháng này',
          'Liên hệ chuyên viên',
        ],
        intent: 'off_topic',
      };
    }

    // Greeting patterns
    if (
      lowerMessage.includes('chào') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi')
    ) {
      return {
        response:
          'Chào bạn! 👋 Chào mừng bạn đến với DigitalWorld! Tôi là trợ lý AI công nghệ, sẵn sàng giúp bạn tìm Laptop, Điện thoại và Phụ kiện ưng ý nhất. Bạn cần tôi tư vấn gì ạ?',
        suggestions: [
          'Siêu phẩm bán chạy 🔥',
          'Tìm Laptop theo giá 💻',
          'Điện thoại mới nhất 📱',
          'Xem toàn bộ cửa hàng 🛍️',
        ],
        intent: 'general',
      };
    }

    // Default response
    return {
      response:
        'Tôi là trợ lý ảo của DigitalWorld! 😊 Tôi có thể giúp bạn:\n• Tư vấn cấu hình Laptop/PC\n• So sánh các dòng Smartphone\n• Thông tin bảo hành & sửa chữa\n• Cập nhật giá đồ công nghệ\n\nBạn đang quan tâm đến sản phẩm nào nhỉ?',
      suggestions: [
        'Tìm Laptop 🔍',
        'Chọn Smartphone 📱',
        'Xem Phụ kiện 🎧',
        'Chính sách bảo hành 📋',
      ],
      intent: 'general',
    };
  }
}

module.exports = new GeminiChatbotService();
