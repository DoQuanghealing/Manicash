/* Sinh tile hoạ tiết nền chat (mẫu C đã chốt) + chuỗi data-URI mã hoá sẵn để
 * dán thẳng vào ai-money-chat.css (--tg-doodle-mask). Chạy: node scripts/build-chat-doodle.mjs */

const G = "fill='none' stroke='#fff' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'";

// Nơ tại (cx,cy)
const bow = (cx, cy) =>
  `<path d='M${cx} ${cy} l-13 -7 l0 14 z M${cx} ${cy} l13 -7 l0 14 z'/>` +
  `<circle cx='${cx}' cy='${cy}' r='3.2'/>` +
  `<path d='M${cx - 3} ${cy + 4} l-5 9 M${cx + 3} ${cy + 4} l5 9'/>`;

// Kẹo bọc tại (cx,cy)
const candy = (cx, cy) =>
  `<ellipse cx='${cx}' cy='${cy}' rx='8' ry='6'/>` +
  `<path d='M${cx - 8} ${cy} l-6 -5 l0 10 z M${cx + 8} ${cy} l6 -5 l0 10 z'/>`;

// Xu đô la tại (cx,cy,r)
const dollar = (cx, cy, r = 12) =>
  `<circle cx='${cx}' cy='${cy}' r='${r}'/>` +
  `<path d='M${cx} ${cy - 7} v14 M${cx + 3} ${cy - 4} a3.5 3 0 0 0 -3 -2 h-1 a3 3 0 0 0 0 6 h2 a3 3 0 0 1 0 6 h-1 a3.5 3 0 0 1 -3 -2'/>`;

// Mũi tên tăng trưởng zíc zắc tại (x,y) — đáy trái, đi lên phải, có đầu mũi tên
const growth = (x, y) =>
  `<path d='M${x} ${y} l6 -7 l5 4 l6 -9 l5 3 l7 -10'/>` +
  `<path d='M${x + 23} ${y - 19} l-6 0 M${x + 23} ${y - 19} l0 6'/>`;

// Vương miện tại (x,y) — 3 chóp, có băng đáy + hạt trên chóp
const crown = (x, y) =>
  `<path d='M${x} ${y + 13} L${x + 1} ${y} L${x + 6} ${y + 7} L${x + 11} ${y - 3} L${x + 16} ${y + 7} L${x + 21} ${y} L${x + 22} ${y + 13} Z'/>` +
  `<path d='M${x + 2} ${y + 10} h18'/>` +
  `<circle cx='${x + 1}' cy='${y}' r='1.4'/><circle cx='${x + 11}' cy='${y - 3}' r='1.4'/><circle cx='${x + 21}' cy='${y}' r='1.4'/>`;

// Bố cục 8 hoạ tiết trải đều 200×200 (mỗi loại xuất hiện ≥1, nơ/vương miện/tên ×2)
const motifs =
  bow(36, 36) +
  crown(112, 24) +
  growth(160, 52) +
  candy(30, 104) +
  dollar(104, 112) +
  crown(160, 150) +
  bow(58, 172) +
  growth(120, 168);

const svg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>` +
  `<g ${G}>${motifs}</g></svg>`;

console.log('--- RAW SVG ---');
console.log(svg);
console.log('\n--- CSS data-URI (dán vào --tg-doodle-mask) ---');
console.log(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
