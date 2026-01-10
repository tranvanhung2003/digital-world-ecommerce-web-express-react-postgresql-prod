# E-commerce Backend API

Backend API cho website bán hàng, được xây dựng bằng Node.js, Express và Sequelize.

## Tính năng

- Xác thực người dùng (đăng ký, đăng nhập, quên mật khẩu)
- Quản lý sản phẩm và danh mục
- Giỏ hàng và thanh toán
- Quản lý đơn hàng
- Đánh giá sản phẩm
- Danh sách yêu thích
- Quản lý địa chỉ người dùng

## Yêu cầu

- Node.js (v16+)
- PostgreSQL
- Redis (tùy chọn)

## Cài đặt

1. Clone repository:

```bash
git clone <repository-url>
cd backend
```

2. Cài đặt các dependencies:

```bash
npm install
```

3. Tạo file .env từ file .env.example và cấu hình các biến môi trường:

```bash
cp .env.example .env
```

4. Tạo database và chạy migrations:

```bash
npm run db:migrate
```

5. (Tùy chọn) Chạy seeders để tạo dữ liệu mẫu:

```bash
npm run db:seed
```

## Chạy ứng dụng

### Development mode:

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

## API Endpoints

### Admin

- `GET /api/admin/dashboard` - Thống kê tổng quan
- `GET /api/admin/stats` - Thống kê chi tiết theo khoảng thời gian
- `GET /api/admin/users` - Lấy danh sách user
- `PUT /api/admin/users/:id` - Cập nhật thông tin user
- `DELETE /api/admin/users/:id` - Xóa user
- `GET /api/admin/products/:id` - Lấy chi tiết sản phẩm
- `POST /api/admin/products` - Tạo sản phẩm mới
- `PUT /api/admin/products/:id` - Cập nhật sản phẩm
- `DELETE /api/admin/products/:id` - Xóa sản phẩm
- `GET /api/admin/products` - Lấy danh sách sản phẩm với filter admin
- `GET /api/admin/reviews` - Lấy danh sách review
- `DELETE /api/admin/reviews/:id` - Xóa review
- `GET /api/admin/orders` - Lấy danh sách đơn hàng
- `PUT /api/admin/orders/:id/status` - Cập nhật trạng thái đơn hàng
- `POST /api/admin/products/:id/clone` - Clone sản phẩm
- `PATCH /api/admin/products/:id/status` - Cập nhật trạng thái nhanh

### Auth

- `POST /api/auth/register` - Đăng ký người dùng mới
- `POST /api/auth/login` - Đăng nhập người dùng
- `POST /api/auth/logout` - Đăng xuất người dùng
- `GET /api/auth/verify-email/:token` - Xác thực email với token (GET method)
- `POST /api/auth/verify-email` - Xác thực email với token (POST method)
- `POST /api/auth/resend-verification` - Gửi lại email xác thực
- `POST /api/auth/refresh-token` - Làm mới token
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/reset-password` - Đặt lại mật khẩu
- `GET /api/auth/me` - Lấy thông tin người dùng hiện tại

### Users

- `PUT /api/users/profile` - Cập nhật thông tin cá nhân
- `POST /api/users/change-password` - Đổi mật khẩu
- `GET /api/users/addresses` - Lấy danh sách địa chỉ
- `POST /api/users/addresses` - Thêm địa chỉ mới
- `PUT /api/users/addresses/:id` - Cập nhật địa chỉ
- `DELETE /api/users/addresses/:id` - Xóa địa chỉ
- `PATCH /api/users/addresses/:id/default` - Đặt địa chỉ mặc định

### Categories

- `GET /api/categories` - Lấy tất cả danh mục
- `GET /api/categories/tree` - Lấy cây danh mục
- `GET /api/categories/:id` - Lấy danh mục theo ID
- `GET /api/categories/slug/:slug` - Lấy danh mục theo slug
- `GET /api/categories/:id/products` - Lấy sản phẩm theo danh mục
- `POST /api/categories` - Tạo danh mục mới (Admin)
- `PUT /api/categories/:id` - Cập nhật danh mục (Admin)
- `DELETE /api/categories/:id` - Xóa danh mục (Admin)

### Products

- `GET /api/products` - Lấy tất cả sản phẩm
- `GET /api/products/featured` - Lấy sản phẩm nổi bật
- `GET /api/products/search` - Tìm kiếm sản phẩm
- `GET /api/products/:id` - Lấy sản phẩm theo ID
- `GET /api/products/slug/:slug` - Lấy sản phẩm theo slug
- `GET /api/products/:id/related` - Lấy sản phẩm liên quan
- `POST /api/products` - Tạo sản phẩm mới (Admin)
- `PUT /api/products/:id` - Cập nhật sản phẩm (Admin)
- `DELETE /api/products/:id` - Xóa sản phẩm (Admin)

### Cart

- `GET /api/cart` - Lấy giỏ hàng
- `POST /api/cart` - Thêm sản phẩm vào giỏ hàng
- `PUT /api/cart/items/:id` - Cập nhật số lượng sản phẩm
- `DELETE /api/cart/items/:id` - Xóa sản phẩm khỏi giỏ hàng
- `DELETE /api/cart` - Xóa tất cả sản phẩm trong giỏ hàng
- `GET /api/cart/count` - Lấy số lượng sản phẩm trong giỏ hàng
- `POST /api/cart/sync` - Sync giỏ hàng từ local storage lên server
- `POST /api/cart/merge` - Gộp giỏ hàng của guest vào giỏ hàng người dùng (khi người dùng đăng nhập)

### Orders

- `POST /api/orders` - Tạo đơn hàng mới
- `GET /api/orders` - Lấy danh sách đơn hàng của người dùng
- `GET /api/orders/:id` - Lấy chi tiết đơn hàng theo ID
- `GET /api/orders/number/:number` - Lấy chi tiết đơn hàng theo số đơn hàng
- `POST /api/orders/:id/cancel` - Hủy đơn hàng
- `GET /api/orders/admin/all` - Lấy tất cả đơn hàng (Admin)
- `PATCH /api/orders/admin/:id/status` - Cập nhật trạng thái đơn hàng (Admin)

### Reviews

- `GET /api/reviews/product/:productId` - Lấy đánh giá của sản phẩm
- `GET /api/reviews/user` - Lấy đánh giá của người dùng
- `POST /api/reviews` - Tạo đánh giá mới
- `PUT /api/reviews/:id` - Cập nhật đánh giá
- `DELETE /api/reviews/:id` - Xóa đánh giá
- `GET /api/reviews/admin/all` - Lấy tất cả đánh giá (Admin)
- `PATCH /api/reviews/admin/:id/verify` - Xác minh đánh giá (Admin)

### Wishlist

- `GET /api/wishlist` - Lấy danh sách yêu thích
- `POST /api/wishlist` - Thêm sản phẩm vào danh sách yêu thích
- `DELETE /api/wishlist/:productId` - Xóa sản phẩm khỏi danh sách yêu thích
- `GET /api/wishlist/check/:productId` - Kiểm tra sản phẩm có trong danh sách yêu thích
- `DELETE /api/wishlist` - Xóa tất cả sản phẩm trong danh sách yêu thích

<!-- ### Attributes (các thuộc tính phân cấp cho sản phẩm)

- `GET /api/attributes/groups` - Lấy tất cả các nhóm thuộc tính cùng với các giá trị của chúng
- `GET /api/attributes/products/:productId/groups` - Lấy các nhóm thuộc tính của một sản phẩm cụ thể
- `POST /api/attributes/groups` - Tạo nhóm thuộc tính mới
- `POST /api/attributes/groups/:attributeGroupId/values` - Thêm giá trị thuộc tính vào nhóm thuộc tính
- `POST /api/attributes/products/:productId/groups/:attributeGroupId` - Gán nhóm thuộc tính cho sản phẩm
- `PUT /api/attributes/groups/:id` - Cập nhật nhóm thuộc tính
- `PUT /api/attributes/values/:id` - Cập nhật giá trị thuộc tính
- `DELETE /api/attributes/groups/:id` - Xóa nhóm thuộc tính (chuyển trạng thái isActive thành false)
- `DELETE /api/attributes/values/:id` - Xóa giá trị thuộc tính (chuyển trạng thái isActive thành false)
- `POST /api/attributes/preview-name` - Xem trước tên sản phẩm với các thuộc tính đã chọn
- `GET /api/attributes/name-affecting` - Lấy danh sách các thuộc tính có ảnh hưởng đến tên sản phẩm
- `POST /api/attributes/batch-generate-names` - Tạo tên sản phẩm hàng loạt dựa trên các mục đã cung cấp
- `POST /api/attributes/generate-name-realtime` - Tạo tên sản phẩm theo thời gian thực dựa trên tên cơ bản và các thuộc tính đã chọn -->

## Cấu trúc thư mục

```
src/
├── config/             # Cấu hình ứng dụng
├── constants/          # Các hằng số
├── controllers/        # Xử lý logic nghiệp vụ
├── database/           # Migrations và seeders
├── middlewares/        # Middleware
├── models/             # Mô hình dữ liệu
├── routes/             # Định nghĩa routes
├── services/           # Các dịch vụ (email, payment, etc.)
├── utils/              # Tiện ích
├── validators/         # Xác thực dữ liệu
├── app.js              # Express app
└── server.js           # Entry point
```

## License

ISC
