// Chat prompt templates and utilities
module.exports = {
  // Check if message is a greeting
  isGreeting: (text) => {
    const greetings = ['xin chào', 'chào', 'hi', 'hello', 'hey'];
    return greetings.some(g => text.toLowerCase().includes(g));
  },

  // Check if message is asking for consultation
  isConsultRequest: (text) => {
    const consultKeywords = ['tư vấn', 'hỏi', 'mua', 'cần'];
    return consultKeywords.some(k => text.toLowerCase().includes(k));
  },

  // Different prompt templates
  prompts: {
    greeting: `Chào bạn! Tôi có thể giúp gì cho bạn? 
Tôi có thể tư vấn về các sản phẩm của chúng tôi. Bạn có thể cho tôi biết:
- Loại sản phẩm bạn quan tâm
- Khoảng giá mong muốn
- Kích thước phù hợp
- Bất kỳ yêu cầu đặc biệt nào khác`,

    consultation: `Để tư vấn sản phẩm phù hợp nhất, xin bạn vui lòng cho biết:
1. Loại sản phẩm bạn đang tìm kiếm? (ví dụ: bình hoa, tượng trang trí...)
2. Kích thước mong muốn?
3. Khoảng giá phù hợp với bạn?
4. Không gian đặt sản phẩm? (phòng khách, phòng ngủ...)
5. Phong cách yêu thích? (hiện đại, cổ điển...)`,

    productRecommendation: (products) => `Dựa trên thông tin sản phẩm:
${products}

Xin tư vấn cho khách hàng các sản phẩm phù hợp nhất (tối đa 3 sản phẩm), bao gồm:
- Tên sản phẩm
- Giá bán
- Lý do sản phẩm phù hợp với khách hàng
- Mô tả ngắn gọn đặc điểm nổi bật
- Link hình ảnh sản phẩm (nếu có)

Trả lời thân thiện và tự nhiên.`
  }
};