require('dotenv').config();
const { News, User } = require('../src/models');

const SEED_NEWS = [
  {
    title: 'Top 5 Laptop Gaming Đáng Mua Nhất Đầu Năm 2025',
    slug: 'top-5-laptop-gaming-2025',
    description:
      'Khám phá những mẫu laptop gaming mạnh mẽ nhất, từ hiệu năng đỉnh cao đến thiết kế ấn tượng trong tầm giá cực tốt tại DigitalWorld.',
    content: `
      <p>Năm 2025 hứa hẹn là một năm bùng nổ của thị trường laptop gaming với sự ra mắt của nhiều dòng chip và card đồ họa thế hệ mới. Tại DigitalWorld, chúng tôi đã tổng hợp danh sách 5 mẫu laptop gaming đáng sở hữu nhất hiện nay dựa trên tiêu chí hiệu năng, tản nhiệt và mức giá.</p>
      
      <h2>1. MSI Raider GE78 HX (2025)</h2>
      <p>Với cấu hình Intel Core i9 Gen 14th và RTX 4090, đây là con quái vật hiệu năng dành cho những game thủ không chấp nhận sự thỏa hiệp. Màn hình 17.3 inch QHD+ 240Hz mang lại trải nghiệm hình ảnh tuyệt mỹ.</p>
      
      <h2>2. Lenovo Legion Pro 7i</h2>
      <p>Sự cân bằng hoàn hảo giữa thiết kế tinh tế và sức mạnh xử lý. Hệ thống tản nhiệt Legion Coldfront 5.0 giúp máy luôn mát mẻ ngay cả khi chạy các tác vụ nặng nhất.</p>
      
      <h2>3. ASUS ROG Zephyrus G14</h2>
      <p>Lựa chọn hàng đầu cho những ai cần sự di động. Một chiếc laptop gaming 14 inch mạnh mẽ, màn hình OLED rực rỡ và thời lượng pin ấn tượng.</p>
      
      <h2>4. Acer Predator Helios Neo 16</h2>
      <p>Vua của phân khúc laptop gaming tầm trung. Hiệu năng vượt trội trong tầm giá với màn hình 16 inch sắc nét và bàn phím RGB 4 vùng cá tính.</p>
      
      <h2>5. Dell Alienware m16 R2</h2>
      <p>Thương hiệu gaming huyền thoại với thiết kế mới gọn gàng hơn nhưng vẫn giữ được "chất" Alienware. Hiệu năng ổn định và dịch vụ bảo hành tận tâm.</p>
      
      <p>Hãy đến ngay các cửa hàng DigitalWorld tại Hà Nội và TP.HCM để trải nghiệm trực tiếp và nhận những phần quà hấp dẫn khi mua laptop gaming trong tháng này!</p>
    `,
    thumbnail:
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?q=80&w=2068&auto=format&fit=crop',
    category: 'Đánh giá',
    tags: 'gaming, laptop, 2025, digitalworld',
    isPublished: true,
  },
  {
    title: 'Hướng Dẫn Tối Ưu Hóa Windows 11 Để Làm Việc Hiệu Quả',
    slug: 'toi-uu-hoa-windows-11-lam-viec',
    description:
      'Mẹo và thủ thuật giúp chiếc laptop của bạn chạy nhanh hơn, mượt mà hơn và giúp bạn tập trung cao độ vào công việc trên Windows 11.',
    content: `
      <p>Windows 11 mang đến giao diện hiện đại, nhưng nếu không biết cách tùy chỉnh, nó có thể làm giảm hiệu suất làm việc của bạn. Dưới đây là những mẹo nhỏ nhưng cực kỳ hữu ích mà DigitalWorld tổng hợp dành cho bạn.</p>
      
      <h3>1. Tận dụng Snap Layouts</h3>
      <p>Sử dụng tổ hợp phím <code>Win + Z</code> để nhanh chóng sắp xếp các cửa sổ ứng dụng. Điều này giúp bạn làm việc đa nhiệm dễ dàng hơn rất nhiều trên các màn hình kích thước lớn.</p>
      
      <h3>2. Tắt các ứng dụng chạy ngầm không cần thiết</h3>
      <p>Vào <b>Settings > Apps > Startup</b> và tắt những ứng dụng bạn không cần dùng ngay khi mở máy. Điều này giúp rút ngắn thời gian khởi động và tiết kiệm RAM.</p>
      
      <h3>3. Sử dụng Virtual Desktops</h3>
      <p>Hãy phân chia không gian làm việc. Ví dụ: một màn hình ảo dành cho các tab nghiên cứu, một màn hình dành cho việc viết lách và một màn hình cho các ứng dụng giải trí.</p>
      
      <p>Nếu bạn gặp bất kỳ vấn đề gì về phần mềm hoặc muốn nâng cấp RAM cho máy tính, đừng ngần ngại mang máy qua DigitalWorld để được hỗ trợ kỹ thuật miễn phí nhé!</p>
    `,
    thumbnail:
      'https://images.unsplash.com/photo-1587614382346-4ec70a388b28?q=80&w=2070&auto=format&fit=crop',
    category: 'Thủ thuật',
    tags: 'windows 11, office, tips, productivity',
    isPublished: true,
  },
  {
    title: 'DigitalWorld Khai Trương Showroom Mới Tại Quận 1, TP.HCM',
    slug: 'digitalworld-khai-truong-showroom-quan-1',
    description:
      'Sự kiện khai trương showroom thứ 3 của DigitalWorld tại TP.HCM với hàng ngàn ưu đãi giảm giá lên đến 50% và quà tặng giá trị.',
    content: `
      <p>Chào đón thành viên mới trong gia đình DigitalWorld! Chúng tôi vô cùng hào hứng thông báo về việc khai trương Showroom tiếp theo tại địa chỉ sầm uất nhất TP.HCM.</p>
      
      <p><b>Thời gian:</b> 08:00 AM - Chủ Nhật, Ngày 15/01/2025</p>
      <p><b>Địa chỉ:</b> Đường Nguyễn Huy Tưởng, Phường 6, Quận Bình Thạnh, TP.HCM</p>
      
      <h3>Chương trình ưu đãi nhân dịp khai trương:</h3>
      <ul>
        <li>Giảm giá trực tiếp 2.000.000đ cho 10 khách hàng mua laptop đầu tiên.</li>
        <li>Tặng bộ Gear trị giá 1.500.000đ cho tất cả đơn hàng trên 20.000.000đ.</li>
        <li>Bốc thăm trúng thưởng 1 chiếc iPhone 16 Pro Max tại sự kiện.</li>
        <li>Vệ sinh máy và cài đặt phần mềm miễn phí cho tất cả khách hàng ghé thăm.</li>
      </ul>
      
      <p>Đây là cơ hội tuyệt vời để bạn sở hữu những món đồ công nghệ yêu thích với mức giá không tưởng. Hẹn gặp lại các bạn tại buổi lễ khai trương hoành tráng tới đây!</p>
    `,
    thumbnail:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop',
    category: 'Tin tức',
    tags: 'digitalworld, event, khai truong, hcm',
    isPublished: true,
  },
  {
    title: 'AI Đang Thay Đổi Cách Chúng Ta Làm Việc Như Thế Nào?',
    slug: 'ai-thay-doi-cach-lam-viec',
    description:
      'Tìm hiểu tầm ảnh hưởng của Trí tuệ nhân tạo (AI) đối với các ngành nghề sáng tạo, lập trình và văn phòng trong năm 2025.',
    content: `
      <p>Trí tuệ nhân tạo không còn là khái niệm của tương lai, nó đang hiện diện trong mọi ngõ ngách của công việc hiện đại. Từ ChatGPT đến Midjourney, AI đang trở thành trợ thủ đắc lực giúp nâng cao năng suất.</p>
      
      <p>Tại DigitalWorld, chúng tôi luôn cập nhật những dòng máy tích hợp NPU (Neural Processing Unit) mạnh mẽ để hỗ trợ tối đa cho các tác vụ AI. Laptop giờ đây không chỉ là công cụ tính toán, mà còn là người cộng sự thông minh.</p>
      
      <p>Liệu AI sẽ thay thế con người hay bổ trợ cho chúng ta? Câu trả lời nằm ở cách chúng ta làm chủ công cụ này. Hãy cùng DigitalWorld thảo luận về xu hướng này trong buổi Workshop sắp tới nhé.</p>
    `,
    thumbnail:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=2070&auto=format&fit=crop',
    category: 'Xu hướng',
    tags: 'ai, technology, future, 2025',
    isPublished: true,
  },
  {
    title: 'Review MacBook Pro M4: Sức Mạnh Đỉnh Cao Từ Apple Silicon',
    slug: 'review-macbook-pro-m4',
    description:
      'Đánh giá chi tiết MacBook Pro M4 mới nhất với hiệu năng vượt trội, màn hình Liquid Retina XDR và thời lượng pin huyền thoại.',
    content: `
      <p>Apple một lần nữa lại khẳng định vị thế dẫn đầu với dòng chip M4 mới nhất. MacBook Pro M4 mang đến những cải tiến mạnh mẽ không chỉ ở nhân xử lý mà còn ở khả năng xử lý đồ họa chuyên nghiệp.</p>
      
      <p>Màn hình với độ sáng lên tới 1000 nits khi hiển thị nội dung SDR giúp bạn làm việc ngoài trời dễ dàng hơn bao giờ hết. Camera 12MP Center Stage mang lại chất lượng cuộc gọi video sắc nét vượt bậc.</p>
      
      <p>Sản phẩm hiện đã có hàng tại DigitalWorld với đầy đủ các phiên bản cấu hình và màu sắc. Đừng bỏ lỡ chương trình trả góp 0% lãi suất cùng nhiều ưu đãi hấp dẫn dành riêng cho học sinh, sinh viên.</p>
    `,
    thumbnail:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=2026&auto=format&fit=crop',
    category: 'Đánh giá',
    tags: 'apple, macbook pro, m4, digitalworld',
    isPublished: true,
  },
  {
    title:
      'Dell XPS 9315 2-in-1: Sự kết hợp hoàn hảo giữa hiệu suất và thiết kế đột phá',
    slug: 'dell-xps-9315-2-in-1-review',
    content:
      '<p>Dell XPS 9315 2-in-1 là một trong những sản phẩm ấn tượng nhất của Dell trong năm nay. Với thiết kế mỏng nhẹ tinh tế và hiệu năng mạnh mẽ từ chip Intel thế hệ mới, đây là sự lựa chọn không thể bỏ qua cho doanh nhân.</p><p>Màn hình 2 trong 1 linh hoạt giúp bạn làm việc ở nhiều chế độ khác nhau...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&q=80&w=800',
    description:
      'Đánh giá chi tiết Dell XPS 9315 2-in-1 với thiết kế mới lạ và hiệu suất ổn định.',
    category: 'Đánh giá',
    tags: 'dell, xps, laptop review, 2in1',
    isPublished: true,
  },
  {
    title: 'Cách chụp màn hình cuộn, màn hình dài trên máy tính Windows',
    slug: 'cach-chup-man-hinh-cuon-windows',
    content:
      '<p>Chụp màn hình cuộn giúp bạn lưu trữ toàn bộ nội dung trang web hoặc tài liệu dài chỉ trong một tấm hình duy nhất. Trên Windows 10 và 11, bạn có thể sử dụng các tổ hợp phím hoặc phần mềm hỗ trợ...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&q=80&w=800',
    description:
      'Hướng dẫn chi tiết cách chụp màn hình cuộn trên Windows 10/11 không cần phần mềm.',
    category: 'Thủ thuật',
    tags: 'windows, tips, screenshot',
    isPublished: true,
  },
  {
    title: 'Có nên nâng cấp CPU laptop? Hướng dẫn và lưu ý quan trọng',
    slug: 'co-nen-nang-cap-cpu-laptop',
    content:
      '<p>Việc nâng cấp CPU có thể giúp laptop chạy nhanh hơn, nhưng không phải lúc nào cũng khả thi. Đa số laptop hiện nay đều hàn chết CPU trên mainboard, vì vậy việc nâng cấp là vô cùng khó khăn...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&q=80&w=800',
    description:
      'Mọi điều bạn cần biết trước khi quyết định nâng cấp CPU cho chiếc laptop của mình.',
    category: 'Tư vấn',
    tags: 'cpu, laptop, upgrade, hardware',
    isPublished: true,
  },
  {
    title: 'Khai trương cơ sở mới của DigitalWorld tại TP.HCM',
    slug: 'khai-truong-co-so-moi-tphcm',
    content:
      '<p>DigitalWorld vui mừng thông báo khai trương cơ sở mới tại quận 1, TP.HCM với nhiều ưu đãi hấp dẫn như giảm giá 20% cho 100 khách hàng đầu tiên, quà tặng phụ kiện...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800',
    description:
      'Chào mừng bạn đến với không gian trải nghiệm công nghệ mới của chúng tôi.',
    category: 'Tin tức',
    tags: 'digitalworld, khai truong, event',
    isPublished: true,
  },
  {
    title: 'Laptop bị liệt phím Enter: Nguyên nhân và cách khắc phục tại nhà',
    slug: 'laptop-bi-liet-phim-enter-fix',
    content:
      '<p>Phím Enter bị liệt gây nhiều phiền toái. Hãy thử những cách sau trước khi mang đi sửa: Vệ sinh phím bấm, kiểm tra driver bàn phím, hoặc sử dụng bàn phím ảo tạm thời...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&q=80&w=800',
    description:
      'Các bước kiểm tra và sửa lỗi phím Enter bị kẹt hoặc liệt đơn giản nhất.',
    category: 'Thủ thuật',
    tags: 'hardware, fix, laptop tips',
    isPublished: true,
  },
  {
    title: 'Top 5 laptop văn phòng tốt nhất dưới 15 triệu đồng năm 2025',
    slug: 'top-5-laptop-van-phong-2025',
    content:
      '<p>Nếu bạn đang tìm kiếm một chiếc laptop văn phòng mỏng nhẹ, hiệu năng tốt trong tầm giá 15 triệu, danh sách này dành cho bạn: MSI Modern, Acer Aspire, HP Pavilion...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800',
    description: 'Danh sách những mẫu laptop văn phòng đáng mua nhất hiện nay.',
    category: 'Tư vấn',
    tags: 'top laptop, van phong, duoi 15 trieu',
    isPublished: true,
  },
  {
    title:
      'Đánh giá ASUS Zenbook 14 OLED: Sự lựa chọn hoàn hảo cho Content Creator',
    slug: 'danh-gia-asus-zenbook-14-oled',
    content:
      '<p>ASUS Zenbook 14 OLED không chỉ đẹp mà còn mạnh mẽ với màn hình OLED rực rỡ chuẩn màu 100% DCI-P3. Đây là người bạn đồng hành lý tưởng cho dân thiết kế và sáng tạo nội dung...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=800',
    description:
      'Zenbook 14 OLED mang đến trải nghiệm làm việc và giải trí tuyệt vời.',
    category: 'Đánh giá',
    tags: 'asus, zenbook, oled, creator',
    isPublished: true,
  },
  {
    title: 'Cách tối ưu hóa Windows 11 để chơi game mượt mà hơn',
    slug: 'toi-uu-hoa-windows-11-choi-game',
    content:
      '<p>Windows 11 có nhiều tính năng hỗ trợ game thủ, nhưng bạn cần biết cách bật chúng đúng cách như Game Mode, Auto HDR để có FPS ổn định nhất...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800',
    description:
      'Tăng FPS và giảm lag khi chơi game trên Windows 11 với những mẹo đơn giản.',
    category: 'Thủ thuật',
    tags: 'gaming, windows 11, optimization',
    isPublished: true,
  },
  {
    title: 'Review MacBook Air M3: Liệu có đáng để nâng cấp từ bản M1?',
    slug: 'review-macbook-air-m3',
    content:
      '<p>Chip M3 mang lại hiệu năng vượt trội, đặc biệt là khả năng xử lý đồ họa và Ray Tracing. Tuy nhiên với người dùng văn phòng cơ bản, M1 vẫn còn rất tốt...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1514820402329-de527fdd2e6d?auto=format&fit=crop&q=80&w=800',
    description:
      'So sánh chi tiết hiệu năng và trải nghiệm giữa MacBook Air M3 và các thế hệ trước.',
    category: 'Đánh giá',
    tags: 'apple, macbook, m3, m1',
    isPublished: true,
  },
  {
    title: 'Dịch vụ vệ sinh laptop miễn phí tại DigitalWorld trong tháng 12',
    slug: 've-sinh-laptop-mien-phi',
    content:
      '<p>Trong tháng tri ân khách hàng, DigitalWorld triển khai chương trình vệ sinh máy miễn phí, tra keo tản nhiệt gấu cho tất cả dòng máy gaming và văn phòng...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&q=80&w=800',
    description:
      'Đến ngay cơ sở gần nhất để được bảo dưỡng máy tính hoàn toàn miễn phí.',
    category: 'Tin tức',
    tags: 'promotion, laptop, service',
    isPublished: true,
  },
  {
    title: 'Mẹo sử dụng phím tắt trên macOS cực hữu ích cho người mới',
    slug: 'phim-tat-macos-cho-nguoi-moi',
    content:
      '<p>Làm chủ macOS nhanh chóng hơn với hệ thống phím tắt cực kỳ tiện lợi như Command + Space, Command + Tab, và các mẹo sử dụng Trackpad thông minh...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1611186871348-b1ec696e52c9?auto=format&fit=crop&q=80&w=800',
    description:
      'Nâng cao năng suất làm việc trên Mac với các tổ hợp phím tắt quyền năng.',
    category: 'Thủ thuật',
    tags: 'macos, mac tip, shortcut',
    isPublished: true,
  },
  {
    title: 'Nên chọn màn hình 144Hz hay 240Hz để chơi game CS2?',
    slug: 'chon-man-hinh-144hz-hay-240hz',
    content:
      '<p>Tần số quét cao mang lại lợi thế lớn trong các tựa game Esport, giúp hình ảnh chuyển động mượt mà và giảm độ trễ đầu vào rõ rệt...</p>',
    thumbnail:
      'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&q=80&w=800',
    description:
      'Phân tích sự khác biệt giữa các tần số quét màn hình phổ biến hiện nay.',
    category: 'Tư vấn',
    tags: 'monitor, 144hz, 240hz, fps',
    isPublished: true,
  },
];

async function seed() {
  try {
    const user = await User.findOne({ where: { role: 'admin' } });

    if (!user) {
      console.error('Không tìm thấy người dùng admin để gán bài viết tin tức.');
      process.exit(1);
    }

    for (const news of SEED_NEWS) {
      await News.findOrCreate({
        where: { slug: news.slug },
        defaults: { ...news, userId: user.id },
      });
    }

    console.log('Seed news thành công.');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi seed news:', error);
    process.exit(1);
  }
}

seed();
