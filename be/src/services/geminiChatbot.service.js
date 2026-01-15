const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Product, Category, sequelize } = require('../models');
const { Op } = require('sequelize');

class GeminiChatbotService {
  constructor() {
    // Khởi tạo Gemini AI client
    this.genAI = null;

    // Gemini model instance
    this.model = null;

    // Tôi sẽ truyền vào một mảng các Gemini model, và chọn model đầu tiên làm mặc định
    // Nếu khi gửi yêu cầu mà model bị lỗi (lỗi quota, limits, ...), thì sẽ tự động
    // chuyển sang model tiếp theo trong mảng để đảm bảo dịch vụ không bị gián đoạn
    this.GEMINI_MODEL = [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3-flash',
    ];
    this.index = 0;

    // Khởi tạo Gemini
    this.initializeGemini();
  }

  /**
   * Hàm khởi tạo Gemini AI
   */
  initializeGemini() {
    try {
      if (
        process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== 'demo-key'
      ) {
        // Khởi tạo Gemini AI client với API key
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Lấy model Gemini đầu tiên từ mảng model đã cấu hình
        this.model = this.genAI.getGenerativeModel({
          model: this.GEMINI_MODEL[this.index],
        });

        console.info(
          `Gemini AI đã được khởi tạo thành công với model: ${this.GEMINI_MODEL[this.index]}`,
        );
      } else {
        console.warn(
          'Không tìm thấy Gemini API key, hãy sử dụng phản hồi dự phòng',
        );
      }
    } catch (error) {
      console.error(
        'Khởi tạo Gemini AI thất bại, hãy sử dụng phản hồi dự phòng:',
        error.message || error,
      );
    }
  }

  /**
   * Chuyển sang model Gemini tiếp theo trong mảng
   * Hàm này được sử dụng trong phần catch khi gửi yêu cầu đến Gemini API
   * Nếu có lỗi xảy ra thì gọi hàm này
   * Nếu trả về true thì có nghĩa là đã chuyển sang model mới thành công, hãy thử gửi lại yêu cầu
   * Nếu trả về false thì có nghĩa là đã hết model để chuyển, hãy sử dụng phản hồi dự phòng
   */
  switchToNextModel() {
    if (this.index < this.GEMINI_MODEL.length - 1) {
      // Nếu còn model tiếp theo, chuyển sang model đó

      // Tăng chỉ số index để lấy model tiếp theo
      this.index += 1;

      // Lấy model Gemini tiếp theo từ mảng model đã cấu hình
      this.model = this.genAI.getGenerativeModel({
        model: this.GEMINI_MODEL[this.index],
      });

      console.info(
        `Đã chuyển sang model Gemini tiếp theo: ${this.GEMINI_MODEL[this.index]}`,
      );

      return true;
    } else {
      // Nếu đã hết model, giữ nguyên model hiện tại và log cảnh báo

      console.warn(
        `Đã hết model Gemini để chuyển sang. Vui lòng kiểm tra cấu hình hoặc chờ đến khi giới hạn được đặt lại. 
        Trong thời gian chờ, hãy sử dụng phản hồi dự phòng.`,
      );

      return false;
    }
  }

  /**
   * Trình xử lý chính của chatbot với AI intelligence
   */
  async handleMessage(message, context = {}) {
    try {
      // Lấy tất cả sản phẩm từ cơ sở dữ liệu
      const allProducts = await this.getAllProducts();

      // Sử dụng Gemini AI để xử lý tin nhắn và lấy phản hồi
      // dựa vào tin nhắn người dùng, danh sách sản phẩm và ngữ cảnh hiện tại
      const aiResponse = await this.getAIResponse(
        message,
        allProducts,
        context,
      );

      // Trả về phản hồi từ AI
      return aiResponse;
    } catch (error) {
      console.error('Lỗi chatbot Gemini:', error);

      // Trả về phản hồi dự phòng trong trường hợp lỗi
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Gửi yêu cầu đến Gemini AI và nhận phản hồi
   */
  async getAIResponse(userMessage, products, context) {
    // Nếu model Gemini chưa được khởi tạo, sử dụng phản hồi dự phòng
    if (!this.model) {
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Tạo prompt chi tiết cho Gemini AI
      // dựa vào tin nhắn người dùng, danh sách sản phẩm và ngữ cảnh hiện tại
      const prompt = this.createPrompt(userMessage, products, context);

      if (process.env.NODE_ENV !== 'production') {
        console.log('Đang gửi request đến Gemini API');
      }

      // Gửi yêu cầu đến Gemini AI để tạo nội dung dựa trên prompt
      // Sau đó chờ phản hồi từ AI
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      if (process.env.NODE_ENV !== 'production') {
        console.log('Phản hồi từ AI:', aiText);
      }

      // Phân tích phản hồi từ AI và nhúng thông tin sản phẩm thực tế vào
      const parsedResponse = this.parseAIResponse(
        aiText,
        products,
        userMessage,
      );

      return parsedResponse;
    } catch (error) {
      console.error('Chi tiết lỗi Gemini API:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
      });

      // Kiểm tra nếu là lỗi 404 cụ thể
      if (error.message && error.message.includes('404')) {
        console.error(
          'Lỗi 404 - Không tìm thấy model hoặc endpoint API không đúng',
        );
      }

      // Thử chuyển sang model tiếp theo nếu có thể
      const switched = this.switchToNextModel();

      if (switched) {
        // Nếu đã chuyển sang model mới thành công, thử gửi lại yêu cầu
        return await this.getAIResponse(userMessage, products, context);
      } else {
        // Nếu không thể chuyển model, sử dụng phản hồi dự phòng
        return this.getFallbackResponse(userMessage);
      }
    }
  }

  /**
   * Tạo prompt chi tiết cho Gemini AI
   */
  createPrompt(userMessage, products, context) {
    // Tạo danh sách sản phẩm dưới dạng chuỗi để đưa vào prompt
    const productList = products
      .map(
        (p) =>
          `- ${p.name}: ${p.shortDescription} (Giá: ${p.price?.toLocaleString('vi-VN')}đ)`,
      )
      .join('\n');

    console.log(
      'Danh sách sản phẩm cho prompt:',
      JSON.stringify(productList, null, 2),
    );

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
- Chuyên: Laptop, Điện thoại, Phụ kiện công nghệ, Linh kiện máy tính, Thiết bị văn phòng, ...
- Giá cả: Từ 200k đến 70 triệu
- Chính sách: Đổi trả trong 7 ngày, miễn phí vận chuyển đơn >500k
- Thanh toán: COD, chuyển khoản, thẻ tín dụng
- Giao hàng: 1-3 ngày trong nội thành, 3-7 ngày ngoại thành
- Hỗ trợ: 24/7 qua chat, hotline: 1900-xxxx

TIN NHẮN KHÁCH HÀNG: "${userMessage}"
CONTEXT: ${JSON.stringify(context)}

HƯỚNG DẪN TRẢ LỜI:
- Nếu hỏi về SẢN PHẨM (product_search): Tìm và gợi ý sản phẩm phù hợp
- Nếu hỏi về GIÁ CẢ (pricing): So sánh giá, gợi ý sản phẩm trong tầm giá
- Nếu hỏi về CHÍNH SÁCH (policy): Giải thích rõ ràng về đổi trả, giao hàng
- Nếu hỏi về HỖ TRỢ (support): Hướng dẫn chi tiết, cung cấp liên hệ hỗ trợ
- Nếu KHIẾU NẠI (complaint): Thể hiện sự quan tâm, hướng dẫn giải quyết
- Nếu HỎI CHUNG (general): Trò chuyện thân thiện, hướng về sản phẩm
- Nếu HỎI NGOÀI LĨNH VỰC (off_topic): Trả lời thông minh, hài hước và thân thiện. Có thể trả lời các câu hỏi kiến thức chung, nhưng sau đó nhẹ nhàng chuyển hướng về shop.

Hãy trả lời theo format JSON sau (TUYỆT ĐỐI CHỈ TRẢ VỀ JSON, KHÔNG KÈM BẤT KỲ VĂN BẢN NÀO KHÁC NGOÀI KHỐI JSON):
{
  "response": "Câu trả lời chi tiết, thân thiện và hữu ích",
  "matchedProducts": ["tên sản phẩm 1", "tên sản phẩm 2", ...],
  "suggestions": ["gợi ý 1", "gợi ý 2", "gợi ý 3", "gợi ý 4"],
  "intent": "product_search|pricing|policy|support|complaint|general|off_topic"
}

LƯU Ý VỀ DỮ LIỆU JSON TRẢ VỀ:
- Đảm bảo JSON hợp lệ, không có lỗi cú pháp
- Các tên sản phẩm trong "matchedProducts" phải khớp chính xác với tên trong danh sách sản phẩm có sẵn
- Tìm "intent" phù hợp nhất dựa trên tin nhắn người dùng, và phải là một trong các giá trị đã cho

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
   * Phân tích phản hồi từ AI và nhúng thông tin sản phẩm thực tế vào
   */
  parseAIResponse(aiText, products, userMessage) {
    try {
      // Tìm khối JSON trong phản hồi của AI
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        // Nếu tìm thấy khối JSON, phân tích nó
        const parsed = JSON.parse(jsonMatch[0]);

        // Tìm đối tượng các sản phẩm thực tế dựa trên đề xuất của AI
        const matchedProducts = [];

        // Duyệt qua tên sản phẩm được AI đề xuất và tìm trong danh sách sản phẩm thực tế
        if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
          parsed.matchedProducts.forEach((productName) => {
            // Tìm sản phẩm trong danh sách dựa trên tên (so sánh không phân biệt hoa thường)
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

        console.log('Đã phân tích phản hồi AI thành công');

        return {
          response:
            parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
          products: matchedProducts,
          suggestions: parsed.suggestions || [
            'Xem tất cả sản phẩm',
            'Chính sách đổi trả',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
          intent: parsed.intent || 'general',
        };
      }
    } catch (error) {
      console.error('Phân tích phản hồi AI thất bại:', error.message || error);
    }

    // Dự phòng: Nếu phân tích JSON thất bại, sử dụng tìm kiếm từ khóa đơn giản
    return this.simpleKeywordMatch(userMessage, products);
  }

  /**
   * Tìm kiếm sản phẩm đơn giản dựa trên từ khóa trong tin nhắn người dùng
   * Chỉ được dùng khi phân tích phản hồi AI thất bại
   */
  simpleKeywordMatch(userMessage, products) {
    const lowerMessage = userMessage.toLowerCase().trim();

    let matchedProducts = [];

    // Trích xuất các từ khóa tìm kiếm từ tin nhắn người dùng
    const searchTerms = lowerMessage
      .split(' ')
      .filter((term) => term.length > 1); // Loại bỏ các từ ngắn

    searchTerms.push(lowerMessage); // Thêm toàn bộ tin nhắn làm từ khóa tìm kiếm

    // Tạo keyword mapping để mở rộng tìm kiếm
    // Các sản phẩm liên quan đến thiết bị điện tử
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

    // Mở rộng từ khóa tìm kiếm dựa trên mapping
    const expandedTerms = [...searchTerms];

    // Duyệt qua mapping và thêm các từ khóa liên quan
    Object.keys(keywordMapping).forEach((viTerm) => {
      if (lowerMessage.includes(viTerm)) {
        expandedTerms.push(...keywordMapping[viTerm]);
      }
    });

    // Tìm kiếm sản phẩm dựa trên các từ khóa động của sản phẩm
    products.forEach((product) => {
      // Tính điểm khớp cho mỗi sản phẩm
      let matchScore = 0;

      const productName = product.name?.toLowerCase() || '';
      const productDesc = product.shortDescription?.toLowerCase() || '';
      const productFullDesc = product.description?.toLowerCase() || '';

      // 1. So khớp trực tiếp với tên sản phẩm (ưu tiên cao nhất)
      expandedTerms.forEach((term) => {
        if (productName.includes(term.toLowerCase())) {
          matchScore += 10;
        }
      });

      // 2. So khớp với mô tả ngắn
      expandedTerms.forEach((term) => {
        if (productDesc.includes(term.toLowerCase())) {
          matchScore += 8;
        }
      });

      // 3. So khớp với từ khóa tìm kiếm của sản phẩm (có trong database)
      if (product.searchKeywords && Array.isArray(product.searchKeywords)) {
        expandedTerms.forEach((term) => {
          const keywordMatches = product.searchKeywords.filter(
            (keyword) =>
              keyword.toLowerCase().includes(term.toLowerCase()) ||
              term.toLowerCase().includes(keyword.toLowerCase()),
          );

          if (keywordMatches.length > 0) {
            matchScore += keywordMatches.length * 5;
          }
        });
      }

      // 4. So khớp một phần với toàn bộ văn bản sản phẩm
      const productText = `${productName} ${productDesc} ${productFullDesc}`;
      expandedTerms.forEach((term) => {
        if (productText.includes(term.toLowerCase())) {
          matchScore += 2;
        }
      });

      // Thêm sản phẩm nếu có điểm khớp > 0
      if (matchScore > 0) {
        matchedProducts.push({ ...product, matchScore });
      }
    });

    // Sắp xếp sản phẩm theo điểm khớp (cao nhất trước, thấp nhất sau)
    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

    // Loại bỏ sản phẩm trùng lặp dựa trên ID (nếu có)
    const uniqueProducts = matchedProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id),
    );

    if (uniqueProducts.length > 0) {
      // Tạo danh sách sản phẩm để hiển thị trong phản hồi, giới hạn 5 sản phẩm
      const productList = uniqueProducts
        .slice(0, 5)
        .map((p) => `• ${p.name} - ${p.price?.toLocaleString('vi-VN')}đ`)
        .join('\n');

      return {
        response: `Tôi tìm thấy ${uniqueProducts.length} sản phẩm phù hợp với "${userMessage}":\n\n${productList}\n\nBạn muốn xem chi tiết sản phẩm nào không?`,
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
          'Chính sách đổi trả',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
        intent: 'product_search',
      };
    }

    // Nếu không tìm thấy sản phẩm nào, sử dụng phản hồi dự phòng
    return this.getFallbackResponse(userMessage);
  }

  /**
   * Lấy tất cả sản phẩm từ cơ sở dữ liệu
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
        limit: 100, // Giới hạn số sản phẩm để tránh quá tải
        order: [['createdAt', 'DESC']],
      });

      return products.map((p) => p.toJSON());
    } catch (error) {
      console.error('Lỗi khi lấy sản phẩm:', error);

      return [];
    }
  }

  /**
   * Phản hồi dự phòng nâng cao cho các tình huống khác nhau
   * Chỉ được sử dụng khi Gemini AI không khả dụng hoặc phân tích thất bại
   */
  getFallbackResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Laptop & Máy tính
    const laptopKeywords = ['laptop', 'máy tính', 'macbook'];
    if (this.matchesPatterns(lowerMessage, laptopKeywords)) {
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

    // Điện thoại & Smartphone
    const phoneKeywords = ['điện thoại', 'phone', 'iphone', 'samsung'];
    if (this.matchesPatterns(lowerMessage, phoneKeywords)) {
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

    // Phụ kiện & Linh kiện
    const accessoryKeywords = ['phụ kiện', 'tai nghe', 'chuột', 'bàn phím'];
    if (this.matchesPatterns(lowerMessage, accessoryKeywords)) {
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

    // Pricing inquiries (hỏi đáp khoảng giá đồ điện tử)
    const pricingKeywords = ['giá', 'bao nhiêu', 'price'];
    if (this.matchesPatterns(lowerMessage, pricingKeywords)) {
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

    // Policy inquiries (hỏi đáp bảo hành điện tử)
    const policyKeywords = ['đổi trả', 'bảo hành', 'chính sách'];
    if (this.matchesPatterns(lowerMessage, policyKeywords)) {
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

    // Shipping inquiries (hỏi đáp giao hàng)
    const shippingKeywords = ['giao hàng', 'ship', 'vận chuyển'];
    if (this.matchesPatterns(lowerMessage, shippingKeywords)) {
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

    // Tech Specs inquiries (hỏi đáp cấu hình kỹ thuật)
    const specsKeywords = ['cấu hình', 'thông số', 'ram', 'kích thước'];
    if (this.matchesPatterns(lowerMessage, specsKeywords)) {
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

    // Complaint handling (xử lý khiếu nại)
    const complaintKeywords = ['khiếu nại', 'phàn nàn', 'không hài lòng'];
    if (this.matchesPatterns(lowerMessage, complaintKeywords)) {
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

    // Off-topic: Weather (thời tiết)
    const weatherKeywords = ['thời tiết', 'weather', 'nắng', 'mưa'];
    if (this.matchesPatterns(lowerMessage, weatherKeywords)) {
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

    // Off-topic: Food (ẩm thực)
    const foodKeywords = ['ăn', 'food', 'món'];
    if (this.matchesPatterns(lowerMessage, foodKeywords)) {
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

    // Chính trị, lịch sử (politics, history)
    const politicsKeywords = ['chính trị', 'lịch sử', 'chiến tranh', 'đảng'];
    if (this.matchesPatterns(lowerMessage, politicsKeywords)) {
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

    // Greeting patterns (Chào hỏi)
    const greetingKeywords = ['chào', 'hello', 'hi'];
    if (this.matchesPatterns(lowerMessage, greetingKeywords)) {
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

    // Default response (Tin nhắn chung chung)
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

  // Helper methods
  matchesPatterns(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }
}

module.exports = new GeminiChatbotService();
