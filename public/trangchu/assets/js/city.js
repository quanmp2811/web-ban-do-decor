(function(){
  const top = ["TP Hà Nội", "TP Hồ Chí Minh"];
  const rest = [
    "An Giang",
    "Bắc Ninh",
    "Cà Mau",
    "Cao Bằng",
    "Đắk Lắk",
    "Điện Biên",
    "Đồng Nai",
    "Đồng Tháp",
    "Gia Lai",
    "Hà Tĩnh",
    "Hưng Yên",
    "Khánh Hòa",
    "Lai Châu",
    "Lâm Đồng",
    "Lào Cai",
    "Nghệ An",
    "Ninh Bình",
    "Phú Thọ",
    "Quảng Ngãi",
    "Quảng Ninh",
    "Quảng Trị",
    "Sơn La",
    "Tây Ninh",
    "Thái Nguyên",
    "TP Cần Thơ",
    "TP Đà Nẵng",
    "TP Hải Phòng",
    "TP Huế",
    "Tuyên Quang",
    "Thanh Hóa",
    "Vĩnh Long"
  ];

  rest.sort(function(a,b){ return a.localeCompare(b, 'vi'); });
  window.provincesVN = top.concat(rest);
})();