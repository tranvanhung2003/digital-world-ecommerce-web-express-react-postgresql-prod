class KeywordGeneratorService {
  /**
   * Tạo search keywords cho sản phẩm dựa trên:
   * tên, mô tả ngắn, mô tả chi tiết, danh mục, thương hiệu, từ khóa theo danh mục
   */
  generateKeywords(productData) {
    const keywords = new Set();

    // Trích xuất keywords từ tên sản phẩm
    if (productData.name) {
      const nameWords = this.extractWords(productData.name);
      nameWords.forEach((word) => keywords.add(word));
    }

    // Trích xuất keywords từ mô tả ngắn
    if (productData.shortDescription) {
      const shortDescWords = this.extractWords(productData.shortDescription);
      shortDescWords.forEach((word) => keywords.add(word));
    }

    // Trích xuất keywords từ mô tả chi tiết
    if (productData.description) {
      const descWords = this.extractWords(productData.description);
      descWords.forEach((word) => keywords.add(word));
    }

    // Trích xuất keywords từ danh mục
    if (productData.category) {
      const categoryWords = this.extractWords(productData.category);
      categoryWords.forEach((word) => keywords.add(word));
    }

    // Trích xuất keywords thương hiệu dựa trên tên sản phẩm
    const brandKeywords = this.extractBrandKeywords(productData.name);
    brandKeywords.forEach((keyword) => keywords.add(keyword));

    // Trích xuất keywords danh mục dựa trên các thông tin sản phẩm
    const categoryKeywords = this.getCategoryKeywords(productData);
    categoryKeywords.forEach((keyword) => keywords.add(keyword));

    // Chuyển về mảng, lọc các từ ngắn và giới hạn số lượng keywords
    return Array.from(keywords)
      .filter((keyword) => keyword.length > 1) // Loại bỏ các từ có độ dài <= 1
      .map((keyword) => keyword.toLowerCase())
      .slice(0, 20); // Giới hạn tối đa 20 keywords
  }

  /**
   * Trích xuất các từ có ý nghĩa từ một đoạn văn bản
   */
  extractWords(text) {
    if (!text) return [];

    const words = text
      // Chuyển về chữ thường
      .toLowerCase()
      // Giữ lại chữ cái Unicode, chữ số và khoảng trắng, thay thế ký tự đặc biệt bằng khoảng trắng
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      // Tách từ dựa trên khoảng trắng
      .split(/\s+/)
      // Loại bỏ các từ có độ dài <= 1
      .filter((word) => word.length > 1);

    // Liệt kê các từ dừng (stop words) phổ biến trong tiếng Việt và tiếng Anh
    const stopWords = new Set([
      // Tiếng Việt: Hư từ, đại từ, từ nối
      'của',
      'với',
      'cho',
      'và',
      'hoặc',
      'là',
      'có',
      'được',
      'trong',
      'tại',
      'ra',
      'vào',
      'lên',
      'xuống',
      'đến',
      'đi',
      'bởi',
      'như',
      'nhưng',
      'mà',
      'cũng',
      'đã',
      'đang',
      'sẽ',
      'vừa',
      'mới',
      'từng',
      'vẫn',
      'luôn',
      'ngay',
      'chỉ',
      'lại',
      'thêm',
      'quá',
      'rất',
      'lắm',
      'này',
      'kia',
      'đó',
      'nọ',
      'ấy',
      'nào',
      'gì',
      'sao',
      'đâu',
      'cái',
      'chiếc',
      'những',
      'các',
      'mọi',
      'mỗi',
      'từng',
      'một',
      'hai',
      'ba',
      'bốn',
      'năm',
      'nhiều',
      'ít',
      'vài',
      'tôi',
      'bạn',
      'anh',
      'chị',
      'em',
      'họ',
      'nó',
      'chúng',
      'ta',
      'người',
      'vì',
      'nên',
      'nếu',
      'thì',
      'tuy',
      'dù',
      'bằng',
      'theo',
      'trên',
      'dưới',

      // Tiếng Anh: Articles, Prepositions, Conjunctions, Pronouns
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'if',
      'then',
      'else',
      'when',
      'at',
      'by',
      'from',
      'for',
      'in',
      'off',
      'on',
      'out',
      'over',
      'to',
      'up',
      'with',
      'about',
      'as',
      'into',
      'with',
      'within',
      'without',
      'am',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'shall',
      'should',
      'can',
      'could',
      'may',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'my',
      'your',
      'his',
      'her',
      'its',
      'this',
      'that',
      'these',
      'those',
      'which',
      'who',
      'whom',
      'whose',
      'what',
    ]);

    // Lọc bỏ các từ dừng (stop words)
    return words.filter((word) => !stopWords.has(word));
  }

  /**
   * Trích xuất các từ khóa thương hiệu từ tên sản phẩm
   */
  extractBrandKeywords(productName) {
    if (!productName) return [];

    const brandMappings = {
      // --- LAPTOP & MÁY TÍNH ---
      apple: [
        'apple',
        'macbook',
        'macbook air',
        'macbook pro',
        'imac',
        'mac mini',
        'mac studio',
        'mac pro',
        'm1',
        'm2',
        'm3',
        'retina',
      ],
      dell: [
        'dell',
        'xps',
        'inspiron',
        'latitude',
        'precision',
        'alienware',
        'vostro',
        'g15',
        'g16',
      ],
      hp: [
        'hp',
        'hewlett packard',
        'pavilion',
        'envy',
        'spectre',
        'omen',
        'victus',
        'probook',
        'elitebook',
        'zbook',
        'dragonfly',
      ],
      lenovo: [
        'lenovo',
        'thinkpad',
        'ideapad',
        'yoga',
        'legion',
        'loq',
        'thinkbook',
        'thinkstation',
        'slim',
      ],
      asus: [
        'asus',
        'rog',
        'republic of gamers',
        'tuf',
        'tuf gaming',
        'zenbook',
        'vivobook',
        'expertbook',
        'zephyrus',
        'strix',
      ],
      acer: [
        'acer',
        'aspire',
        'nitro',
        'predator',
        'swift',
        'spin',
        'travelmate',
      ],
      msi: [
        'msi',
        'micro star',
        'titan',
        'raider',
        'stealth',
        'vector',
        'katana',
        'cyborg',
        'prestige',
        'modern',
        'summit',
      ],
      microsoft: [
        'microsoft',
        'surface',
        'surface pro',
        'surface laptop',
        'surface go',
        'surface studio',
        'surface book',
      ],
      lg: [
        'lg',
        'gram',
        'lg gram',
        'ultragear',
        'ultrafine', // Bao gồm cả Laptop và Màn hình
      ],
      gigabyte: [
        'gigabyte',
        'aorus',
        'aero',
        'g5',
        'g7', // Bao gồm Laptop và Linh kiện
      ],

      // --- ĐIỆN THOẠI & MÁY TÍNH BẢNG ---
      samsung: [
        'samsung',
        'galaxy',
        'galaxy s',
        's24',
        's23',
        'galaxy z',
        'fold',
        'flip',
        'galaxy a',
        'galaxy m',
        'galaxy tab',
        'note',
        'exynos',
      ],
      xiaomi: [
        'xiaomi',
        'mi',
        'redmi',
        'redmi note',
        'poco',
        'black shark',
        'xiaomi pad',
        'hyperos',
        'miui',
      ],
      oppo: ['oppo', 'reno', 'find x', 'find n', 'a series', 'coloros'],
      vivo: ['vivo', 'x series', 'v series', 'y series', 'iqoo', 'funtouch'],
      realme: ['realme', 'narzo', 'gt', 'c series'],
      google: [
        'google',
        'pixel',
        'pixel pro',
        'pixel fold',
        'tensor',
        'android',
      ],
      nokia: [
        'nokia',
        'hmd',
        'lumia', // Cho các dòng cũ hoặc feature phone
      ],
      oneplus: ['oneplus', 'nord', 'ace', 'oxygenos'],

      // --- ĐỒNG HỒ THÔNG MINH (SMARTWATCH) ---
      garmin: [
        'garmin',
        'fenix',
        'forerunner',
        'venu',
        'epix',
        'instinct',
        'marq',
        'approach',
        'vivomove',
      ],
      coros: ['coros', 'pace', 'apex', 'vertix'],
      amazfit: ['amazfit', 'gtr', 'gts', 't-rex', 'cheetah', 'bip'],
      huawei: ['huawei', 'watch gt', 'watch fit', 'watch ultimate', 'band'],
      suunto: [
        'suunto',
        'suunto 9',
        'suunto 7',
        'suunto 5',
        'peak',
        'race',
        'vertical',
      ],

      // --- ÂM THANH (TAI NGHE & LOA) ---
      sony: [
        'sony',
        'bravia',
        'wh-1000xm',
        'wf-1000xm',
        'linkbuds',
        'ult',
        'extra bass',
        'walkman',
        'playstation',
      ],
      jbl: [
        'jbl',
        'harman',
        'charge',
        'flip',
        'pulse',
        'boombox',
        'partybox',
        'live',
        'tune',
        'tour',
        'quantum',
      ],
      bose: [
        'bose',
        'quietcomfort',
        'qc',
        'soundlink',
        'revolve',
        'smart soundbar',
      ],
      marshall: [
        'marshall',
        'stanmore',
        'acton',
        'woburn',
        'emberton',
        'major',
        'minor',
        'motif',
        'willen',
      ],
      sennheiser: ['sennheiser', 'momentum', 'hd', 'accentum'],
      'harman kardon': [
        'harman kardon',
        'aura studio',
        'onyx studio',
        'go + play',
        'soundsticks',
      ],
      'audio-technica': ['audio-technica', 'ath', 'm50x', 'm20x'],
      bangolufsen: ['bang & olufsen', 'b&o', 'beosound', 'beolit', 'beoplay'],
      anker_soundcore: ['soundcore', 'liberty', 'life', 'motion', 'space'],

      // --- MÁY ẢNH & QUAY PHIM ---
      canon: [
        'canon',
        'eos',
        'eos r',
        'eos m',
        'powershot',
        'ixus',
        '5d',
        '6d',
        'rf',
        'ef',
      ],
      nikon: [
        'nikon',
        'z series',
        'z6',
        'z7',
        'z8',
        'z9',
        'd series',
        'coolpix',
        'nikkor',
      ],
      fujifilm: [
        'fujifilm',
        'fuji',
        'x-series',
        'x-t',
        'x100',
        'gfx',
        'instax',
        'polaroid',
      ],
      gopro: ['gopro', 'hero', 'hero black', 'max'],
      insta360: ['insta360', 'one x', 'one r', 'go', 'ace pro', 'flow'],
      dji: [
        'dji',
        'mavic',
        'mini',
        'air',
        'osmo',
        'pocket',
        'action',
        'ronin',
        'rs',
      ],

      // --- LINH KIỆN MÁY TÍNH (CPU, GPU, MAIN, RAM) ---
      intel: [
        'intel',
        'core',
        'i3',
        'i5',
        'i7',
        'i9',
        'xeon',
        'pentium',
        'celeron',
        'evo',
        'arc',
        'ultra',
      ],
      amd: [
        'amd',
        'ryzen',
        'radeon',
        'threadripper',
        'epyc',
        'rx',
        'am4',
        'am5',
      ],
      nvidia: [
        'nvidia',
        'geforce',
        'rtx',
        'gtx',
        'quadro',
        'titan',
        'ada lovelace',
        'dlss',
      ],
      corsair: [
        'corsair',
        'vengeance',
        'dominator',
        'icue',
        'k70',
        'k95',
        'hs',
        'virtuoso',
      ],
      kingston: [
        'kingston',
        'fury',
        'beast',
        'renegade',
        'canvas',
        'hyperx', // HyperX giờ thuộc HP nhưng RAM vẫn Kingston
      ],
      gskill: ['g.skill', 'gskill', 'trident z', 'ripjaws', 'royal'],
      asrock: [
        'asrock',
        'taichi',
        'phantom gaming',
        'steel legend',
        'challenger',
      ],

      // --- THIẾT BỊ LƯU TRỮ (SSD, HDD, THẺ NHỚ) ---
      wd: [
        'western digital',
        'wd',
        'wd black',
        'wd blue',
        'wd green',
        'wd red',
        'my passport',
        'elements',
        'sn850',
        'sn770',
      ],
      sandisk: ['sandisk', 'extreme', 'extreme pro', 'cruzer', 'ultra'],
      seagate: [
        'seagate',
        'barracuda',
        'ironwolf',
        'skyhawk',
        'firecuda',
        'one touch',
      ],
      lexar: ['lexar', 'professional', 'jumpdrive'],

      // --- PHỤ KIỆN & PERIPHERALS (CHUỘT, PHÍM) ---
      logitech: [
        'logitech',
        'logi',
        'mx master',
        'mx anywhere',
        'g pro',
        'g502',
        'superlight',
        'silent',
        'k380',
        'k480',
        'signature',
      ],
      razer: [
        'razer',
        'deathadder',
        'basilisk',
        'viper',
        'blackwidow',
        'huntsman',
        'kraken',
        'barracuda',
        'blade',
      ],
      steelseries: [
        'steelseries',
        'arctis',
        'apex',
        'rival',
        'sensei',
        'aerox',
      ],
      keychron: ['keychron', 'k2', 'k4', 'k6', 'k8', 'q1', 'v1'],
      akko: ['akko', 'monsgeek', 'mod 007'],
      dareu: ['dareu', 'ek', 'em', 'eh'],

      // --- PHỤ KIỆN SẠC CÁP ---
      anker: ['anker', 'powercore', 'nano', 'maggo', 'powerport', 'eufy'],
      baseus: ['baseus', 'blade', 'gan'],
      ugreen: ['ugreen', 'nexode', 'hitune'],
      belkin: ['belkin', 'boostcharge', 'soundform'],

      // --- THIẾT BỊ MẠNG (WIFI, ROUTER) ---
      tplink: ['tp-link', 'tplink', 'archer', 'deco', 'tapo', 'omada'],
      ubiquiti: ['ubiquiti', 'unifi', 'edgemax', 'amplifi', 'dream machine'],
      linksys: ['linksys', 'velop', 'hydra', 'atlas'],
      totolink: ['totolink', 'ex'],

      // --- MÀN HÌNH (MONITORS) ---
      viewsonic: ['viewsonic', 'vx', 'omni', 'colorpro'],
      aoc: ['aoc', 'agon', 'g-menu'],
      benq: ['benq', 'zowie', 'mobiuz', 'pd series', 'gw series'],

      // --- ĐIỆN TỬ GIA DỤNG (HOME ELECTRONICS) ---
      dyson: [
        'dyson',
        'v12',
        'v15',
        'gen5',
        'supersonic',
        'airwrap',
        'corrale',
      ],
      ecovacs: ['ecovacs', 'deebot', 'winbot'],
      roborock: ['roborock', 's8', 'q revo', 'dyad'],
      philips: ['philips', 'hue', 'sonicare', 'oneblade'],
      panasonic: [
        'panasonic',
        'nanoe',
        'eneloop',
        'lumix', // Lumix là máy ảnh nhưng thuộc Panasonic
      ],
    };

    const keywords = [];

    // Chuyển tên sản phẩm về chữ thường để so sánh
    const lowerName = productName.toLowerCase();

    for (const [brand, brandKeywords] of Object.entries(brandMappings)) {
      if (lowerName.includes(brand)) {
        keywords.push(...brandKeywords);
      }
    }

    return keywords;
  }

  /**
   * Trích xuất keywords danh mục dựa trên các thông tin sản phẩm
   */
  getCategoryKeywords(productData) {
    const checkMatch = (strings, words) => {
      // Chuyển mảng chuỗi và từ về chữ thường
      const $strings = strings.map((s) => s.toLowerCase());
      const $words = words.map((w) => w.toLowerCase());

      // Trả về true nếu có ít nhất một chuỗi trong mảng chuỗi chứa ít nhất một từ trong mảng từ
      return $strings.some((str) => $words.some((word) => str.includes(word)));
    };

    const keywords = [];

    const name = (productData.name || '').toLowerCase();
    const category = (productData.category || '').toLowerCase();
    const description = (productData.shortDescription || '').toLowerCase();

    // Gom nhóm các input để kiểm tra
    const inputs = [name, category, description];

    /**
     * CẤU HÌNH TỪ KHÓA DANH MỤC
     * triggers: các từ dùng để tìm kiếm/nhận diện trong tên, danh mục, mô tả sản phẩm
     * tags: các từ khóa (keywords) sẽ được gán cho sản phẩm nếu tìm thấy triggers
     */
    const categoryRules = {
      laptop: {
        triggers: [
          'laptop',
          'macbook',
          'notebook',
          'máy tính xách tay',
          'ultrabook',
          'surface book',
          'chromebook',
          'thinkpad',
          'zenbook',
        ],
        tags: [
          'laptop',
          'máy tính xách tay',
          'notebook',
          'computer',
          'pc',
          'macbook',
          'văn phòng',
          'gaming',
          'đồ họa',
          'workstation',
        ],
      },
      phone: {
        triggers: [
          'điện thoại',
          'smartphone',
          'mobile',
          'iphone',
          'galaxy s',
          'galaxy z',
          'zenfone',
          'oppo',
          'xiaomi',
          'redmi',
          'realme',
          'vivo',
        ],
        tags: [
          'điện thoại',
          'smartphone',
          'mobile',
          'cellphone',
          'di động',
          'cảm ứng',
          'ios',
          'android',
          'flagship',
          'camera phone',
        ],
      },
      tablet: {
        triggers: [
          'tablet',
          'máy tính bảng',
          'ipad',
          'galaxy tab',
          'pad',
          'kindle',
          'surface pro',
        ],
        tags: [
          'tablet',
          'máy tính bảng',
          'ipad',
          'pad',
          'giải trí',
          'vẽ đồ họa',
          'di động',
          'học tập',
        ],
      },
      smartwatch: {
        triggers: [
          'smartwatch',
          'đồng hồ thông minh',
          'apple watch',
          'galaxy watch',
          'garmin',
          'kết nối điện thoại',
          'vòng đeo tay',
          'fitness tracker',
        ],
        tags: [
          'smartwatch',
          'đồng hồ',
          'watch',
          'wearable',
          'theo dõi sức khỏe',
          'thể thao',
          'phụ kiện số',
          'chống nước',
        ],
      },
      audio: {
        triggers: [
          'tai nghe',
          'headphone',
          'earphone',
          'airpods',
          'buds',
          'loa',
          'speaker',
          'soundbar',
          'micro',
          'âm thanh',
          'bluetooth speaker',
        ],
        tags: [
          'âm thanh',
          'audio',
          'tai nghe',
          'headphone',
          'loa',
          'speaker',
          'bluetooth',
          'không dây',
          'nhạc',
          'giải trí',
          'bass',
        ],
      },
      camera: {
        triggers: [
          'camera',
          'máy ảnh',
          'máy quay',
          'camcorder',
          'lens',
          'ống kính',
          'flycam',
          'drone',
          'gopro',
          'webcam',
          'mirrorless',
          'dslr',
        ],
        tags: [
          'camera',
          'máy ảnh',
          'photography',
          'quay phim',
          'video',
          'kỹ thuật số',
          'ống kính',
          'lens',
          'sáng tạo',
          'vlog',
        ],
      },
      components: {
        triggers: [
          'cpu',
          'vi xử lý',
          'ram',
          'bo mạch',
          'mainboard',
          'vga',
          'card màn hình',
          'gpu',
          'nguồn',
          'psu',
          'case',
          'vỏ máy',
          'tản nhiệt',
          'cooler',
          'rtx',
          'gtx',
        ],
        tags: [
          'linh kiện',
          'component',
          'pc',
          'phần cứng',
          'hardware',
          'build pc',
          'nâng cấp',
          'diy',
          'gaming gear',
        ],
      },
      monitor: {
        triggers: [
          'màn hình',
          'monitor',
          'lcd',
          'led',
          'display',
          'oled',
          'ultrawide',
          'tần số quét',
          'hz',
          'ips',
          '4k',
        ],
        tags: [
          'màn hình',
          'monitor',
          'display',
          'lcd',
          'led',
          'hình ảnh',
          'gaming',
          'văn phòng',
          'đồ họa',
        ],
      },
      storage: {
        triggers: [
          'ssd',
          'hdd',
          'ổ cứng',
          'thẻ nhớ',
          'sd card',
          'microsd',
          'usb',
          'flash drive',
          'nas',
          'portable drive',
        ],
        tags: [
          'lưu trữ',
          'storage',
          'ổ cứng',
          'ssd',
          'hdd',
          'usb',
          'dữ liệu',
          'bộ nhớ',
          'tốc độ cao',
        ],
      },
      network: {
        triggers: [
          'wifi',
          'router',
          'modem',
          'phát sóng',
          'access point',
          'switch',
          'bộ chia mạng',
          'cáp mạng',
          'ethernet',
          'mesh',
        ],
        tags: [
          'wifi',
          'mạng',
          'internet',
          'network',
          'router',
          'kết nối',
          'không dây',
          'tốc độ cao',
          'băng tần kép',
        ],
      },
      accessories: {
        triggers: [
          'chuột',
          'mouse',
          'bàn phím',
          'keyboard',
          'sạc',
          'charger',
          'cáp',
          'cable',
          'pin dự phòng',
          'hub',
          'adapter',
          'balo laptop',
          'túi chống sốc',
          'lót chuột',
        ],
        tags: [
          'phụ kiện',
          'accessory',
          'chuột',
          'bàn phím',
          'sạc cáp',
          'tiện ích',
          'bảo vệ',
          'kết nối',
          'văn phòng',
        ],
      },
      home_electronics: {
        triggers: [
          'hút bụi',
          'robot',
          'lọc không khí',
          'máy chiếu',
          'tv',
          'tivi',
          'điều hòa',
          'thông minh',
          'smarthome',
          'camera an ninh',
          'khóa cửa',
        ],
        tags: [
          'gia dụng',
          'điện tử',
          'smarthome',
          'nhà cửa',
          'đời sống',
          'thông minh',
          'tiện nghi',
          'tự động hóa',
        ],
      },
    };

    // Duyệt qua từng nhóm danh mục để kiểm tra và gán từ khóa
    for (const catRule of Object.values(categoryRules)) {
      if (checkMatch(inputs, catRule.triggers)) {
        keywords.push(...catRule.tags);
      }
    }

    return keywords;
  }

  /**
   * Cập nhật keywords cho sản phẩm hiện có
   */
  async updateProductKeywords(product) {
    const keywords = this.generateKeywords({
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      category: product.category,
    });

    await product.update({ searchKeywords: keywords });

    return keywords;
  }

  /**
   * Cập nhật hàng loạt keywords cho tất cả sản phẩm
   */
  async updateAllProductKeywords() {
    const { Product } = require('../models');

    try {
      // Lấy tất cả sản phẩm đang hoạt động
      const products = await Product.findAll({
        where: { status: 'active' },
      });

      console.log(`Đang cập nhật keywords cho ${products.length} sản phẩm...`);

      for (const product of products) {
        const keywords = this.generateKeywords({
          name: product.name,
          shortDescription: product.shortDescription,
          description: product.description,
          category: product.category,
        });

        await product.update({ searchKeywords: keywords });
        console.log(`Đã cập nhật keywords cho: ${product.name}`);
      }

      console.log('Đã cập nhật thành công keywords cho tất cả sản phẩm!');
      return true;
    } catch (error) {
      console.error('Lỗi khi cập nhật keywords cho sản phẩm:', error);
      throw error;
    }
  }
}

module.exports = new KeywordGeneratorService();
