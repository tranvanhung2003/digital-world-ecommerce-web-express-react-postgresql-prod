const DEFAULT_LOCAL_BASE = 'http://localhost:8888';

/**
 * Hàm giúp loại bỏ khoảng trắng ở đầu và cuối chuỗi.
 * Nếu chuỗi rỗng sau khi loại bỏ khoảng trắng, trả về null.
 */
const trimToNull = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Hàm giúp chuẩn hóa URL cơ sở bằng cách loại bỏ các dấu gạch chéo ở cuối.
 * Nếu giá trị sau khi loại bỏ khoảng trắng là rỗng, trả về null.
 */
const normalizeBaseUrl = (value) => {
  const trimmed = trimToNull(value);
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

// Lấy các URL cơ sở từ biến môi trường và chuẩn hóa chúng
const apiUrl = normalizeBaseUrl(process.env.API_URL);
const frontendUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
const assetBaseEnv =
  normalizeBaseUrl(process.env.ASSET_BASE_URL) ||
  normalizeBaseUrl(process.env.CDN_BASE_URL);

// Xác định apiRoot từ apiUrl.
// Nếu apiUrl kết thúc bằng '/api', loại bỏ phần đó để lấy apiRoot.
const apiRoot =
  apiUrl && apiUrl.toLowerCase().endsWith('/api')
    ? apiUrl.slice(0, -4)
    : apiUrl;

// Xác định assetBase theo thứ tự ưu tiên:
// 1. ASSET_BASE_URL hoặc CDN_BASE_URL từ biến môi trường
// 2. FRONTEND_URL từ biến môi trường
// 3. apiRoot
// 4. Mặc định là 'http://localhost:8888'
const assetBase =
  normalizeBaseUrl(
    assetBaseEnv || frontendUrl || apiRoot || DEFAULT_LOCAL_BASE,
  ) || DEFAULT_LOCAL_BASE;

// Danh sách các tiền tố URL cần loại bỏ khi xử lý URL hình ảnh
const prefixesToStrip = [
  normalizeBaseUrl('http://localhost:8888'),
  normalizeBaseUrl('http://127.0.0.1:8888'),
  apiUrl, // Ví dụ: 'http://localhost:8888'
  apiRoot, // Ví dụ: 'http://localhost:8888'
  assetBase, // Ví dụ: 'http://localhost:5175'
].filter(Boolean);

/**
 * Hàm giúp chuẩn hóa đường dẫn bằng cách thay thế tất cả dấu gạch chéo ngược `\` thành dấu gạch chéo `/`.
 */
const normalizePath = (value) => value.replace(/\\/g, '/');

/**
 * Hàm giúp đảm bảo rằng chuỗi bắt đầu bằng dấu gạch chéo `/`.
 * Nếu chuỗi đã bắt đầu bằng dấu gạch chéo, trả về chuỗi gốc.
 * Ngược lại, thêm dấu gạch chéo vào đầu chuỗi.
 */
const ensureLeadingSlash = (value) =>
  value.startsWith('/') ? value : `/${value}`;

/**
 * Hàm giúp loại bỏ tất cả dấu gạch chéo `/` ở đầu chuỗi.
 */
const stripLeadingSlash = (value) => value.replace(/^\/+/, '');

/**
 * Hàm giúp kết hợp base URL và path thành một URL hoàn chỉnh.
 * Đảm bảo rằng chỉ có một dấu gạch chéo `/` giữa base và path.
 */
const combineBaseAndPath = (base, path) => {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
};

/**
 * Hàm kiểm tra xem chuỗi có bắt đầu bằng tiền tố đã cho hay không.
 * So sánh không phân biệt chữ hoa chữ thường.
 */
const startsWithPrefix = (value, prefix) =>
  value.toLowerCase().startsWith(prefix.toLowerCase());

/**
 * Hàm kiểm tra xem chuỗi có phải là Data URL hay không.
 * Ví dụ: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
 */
const isDataUrl = (value) => /^data:/i.test(value);

/**
 * Hàm chuẩn hóa và làm sạch giá trị URL hình ảnh được lưu trữ.
 * Nếu là Data URL, trả về nguyên bản.
 */
const sanitizeStoredImageValue = (input) => {
  // Loại bỏ khoảng trắng và kiểm tra giá trị rỗng
  const value = trimToNull(input);
  if (!value) return null;

  // Chuẩn hóa đường dẫn
  // Thay thế dấu gạch chéo ngược bằng dấu gạch chéo
  let sanitized = normalizePath(value);

  // Nếu là Data URL, trả về nguyên bản
  if (isDataUrl(sanitized)) {
    return sanitized;
  }

  // Thay thế '/api/uploads' thành '/uploads'
  sanitized = sanitized.replace(/\/api\/uploads/gi, '/uploads');

  // Loại bỏ các tiền tố không mong muốn
  for (const prefix of prefixesToStrip) {
    if (startsWithPrefix(sanitized, prefix)) {
      sanitized = sanitized.slice(prefix.length);
      break;
    }
  }

  // Loại bỏ dấu gạch chéo ở đầu chuỗi nếu có
  sanitized = stripLeadingSlash(sanitized);

  // Trả về giá trị đã xử lý hoặc null nếu rỗng
  return sanitized.length ? sanitized : null;
};

/**
 * Hàm xây dựng URL công khai hoàn chỉnh cho hình ảnh dựa trên giá trị đầu vào.
 */
const buildPublicImageUrl = (input) => {
  // Loại bỏ khoảng trắng và kiểm tra giá trị rỗng
  const value = trimToNull(input);
  if (!value) return null;

  // Chuẩn hóa đường dẫn
  // Thay thế dấu gạch chéo ngược bằng dấu gạch chéo
  let normalized = normalizePath(value);

  // Nếu là Data URL, trả về nguyên bản
  if (isDataUrl(normalized)) {
    return normalized;
  }

  // Thay thế '/api/uploads' thành '/uploads'
  normalized = normalized.replace(/\/api\/uploads/gi, '/uploads');

  // Nếu là URL tuyệt đối (http:// hoặc https://), kiểm tra và loại bỏ các tiền tố không mong muốn
  if (/^https?:\/\//i.test(normalized)) {
    for (const prefix of prefixesToStrip) {
      if (startsWithPrefix(normalized, prefix)) {
        // Loại bỏ tiền tố không mong muốn
        const suffix = normalized.slice(prefix.length);

        // Kết hợp assetBase với phần còn lại của đường dẫn, đảm bảo có dấu gạch chéo ở giữa
        return combineBaseAndPath(assetBase, ensureLeadingSlash(suffix));
      }
    }

    return normalized;
  }

  // Đối với đường dẫn tương đối, kết hợp assetBase với đường dẫn đã chuẩn hóa, đảm bảo có dấu gạch chéo ở giữa
  const pathWithSlash = ensureLeadingSlash(normalized);
  return combineBaseAndPath(assetBase, pathWithSlash);
};

/**
 * Hàm giúp ép giá trị đầu vào thành mảng.
 * Nếu là mảng, trả về nguyên bản.
 * Nếu là chuỗi, cố gắng phân tích cú pháp JSON.
 * Nếu không phải JSON, tách chuỗi thành mảng dựa trên dấu xuống dòng hoặc dấu phẩy.
 * Nếu không có giá trị hợp lệ, trả về mảng rỗng.
 */
const coerceToArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      // Ignore các lỗi JSON parse và xử lý như danh sách phân tách bằng dấu xuống dòng hoặc dấu phẩy
    }

    // Tách chuỗi thành mảng dựa trên dấu xuống dòng hoặc dấu phẩy.
    // Loại bỏ khoảng trắng và các mục rỗng.
    return value
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  // Nếu không phải chuỗi hoặc mảng, trả về mảng rỗng
  return [];
};

/**
 * Hàm giúp chuẩn hóa và làm sạch một collection các giá trị URL hình ảnh được lưu trữ.
 */
const sanitizeImageCollection = (value) =>
  coerceToArray(value).map(sanitizeStoredImageValue).filter(Boolean);

/**
 * Hàm xây dựng một collection các URL công khai hoàn chỉnh cho hình ảnh dựa trên giá trị đầu vào.
 */
const buildPublicImageCollection = (value) =>
  coerceToArray(value).map(buildPublicImageUrl).filter(Boolean);

module.exports = {
  assetBaseUrl: assetBase,
  sanitizeStoredImageValue,
  sanitizeImageCollection,
  buildPublicImageUrl,
  buildPublicImageCollection,
};
