/* Tải curated Fluent Emoji 3D (MIT) → public/emoji/fluent3d/*.webp 128px */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const TREE = process.argv[2];
const OUT = process.argv[3];

const WISH = {
  money: ['Money bag', 'Money with wings', 'Dollar banknote', 'Coin', 'Credit card', 'Bank',
    'Chart increasing', 'Chart decreasing', 'Bar chart', 'Briefcase', 'Gem stone', 'Receipt',
    'Shopping cart', 'Balance scale', 'Abacus', 'Money-mouth face', 'Chart increasing with yen',
    'Convenience store', 'Shopping bags', 'Ledger'],
  animal: ['Fox', 'Dragon', 'Lion', 'Turtle', 'Whale', 'Unicorn', 'Owl', 'Octopus', 'Panda',
    'Eagle', 'Cat face', 'Dog face', 'Tiger face', 'Wolf', 'Bear', 'Rabbit face', 'Monkey face',
    'Penguin', 'Frog', 'Hamster', 'Koala', 'Butterfly', 'Honeybee', 'Dolphin'],
  face: ['Grinning face', 'Smiling face with sunglasses', 'Star-struck', 'Face with tears of joy',
    'Smiling face with heart-eyes', 'Winking face', 'Thinking face', 'Nerd face', 'Partying face',
    'Cowboy hat face', 'Zany face', 'Smiling face with halo', 'Hugging face', 'Shushing face',
    'Face with monocle', 'Smirking face', 'Sleeping face', 'Exploding head'],
  symbol: ['Rocket', 'Glowing star', 'Crystal ball', 'Crescent moon', 'High voltage', 'Top hat',
    'Four leaf clover', 'Rainbow', 'Artist palette', 'Fire', 'Sparkles', 'Sun', 'Trophy', 'Crown',
    'Ring', 'Key', 'Light bulb', 'Locked with key', 'Shield', 'Bullseye', 'Compass', 'Hourglass done'],
  food: ['Bubble tea', 'Hamburger', 'Pizza', 'Sushi', 'Birthday cake', 'Hot beverage', 'Cookie',
    'Ice cream', 'Watermelon', 'Strawberry', 'Steaming bowl', 'Doughnut'],
  party: ['Party popper', 'Balloon', 'Wrapped gift', 'Confetti ball', 'Red envelope', 'Firecracker',
    'Christmas tree', 'Sparkler', 'Ribbon', 'Military medal'],
};

const tree = JSON.parse(await fs.readFile(TREE, 'utf8'));
const byFolder = new Map();
for (const n of tree.tree) {
  const m = n.path.match(/^assets\/([^/]+)\/3D\/([^/]+_3d\.png)$/);
  if (m) byFolder.set(m[1], n.path);
}

await fs.mkdir(OUT, { recursive: true });
const manifest = [];
const missing = [];

for (const [cat, names] of Object.entries(WISH)) {
  for (const name of names) {
    const p = byFolder.get(name);
    if (!p) { missing.push(name); continue; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/' +
      p.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(url);
    if (!res.ok) { missing.push(`${name} (HTTP ${res.status})`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const outFile = path.join(OUT, `${slug}.webp`);
    await sharp(buf).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90 }).toFile(outFile);
    const { size } = await fs.stat(outFile);
    manifest.push({ id: slug, name, cat, bytes: size });
    process.stdout.write('.');
  }
}

console.log(`\nOK ${manifest.length} icons`);
if (missing.length) console.log('MISSING:', missing.join(', '));
const total = manifest.reduce((a, b) => a + b.bytes, 0);
console.log(`Total ${(total / 1024).toFixed(0)} KB, avg ${(total / manifest.length / 1024).toFixed(1)} KB`);
await fs.writeFile(path.join(OUT, '_manifest.json'), JSON.stringify(manifest, null, 2));

/* ── Sinh data module TypeScript cho picker ───────────────────────────── */
const VI = {
  'Money bag': 'Túi tiền', 'Money with wings': 'Tiền bay', 'Dollar banknote': 'Tờ đô',
  Coin: 'Đồng xu', 'Credit card': 'Thẻ tín dụng', Bank: 'Ngân hàng',
  'Chart increasing': 'Biểu đồ tăng', 'Chart decreasing': 'Biểu đồ giảm', 'Bar chart': 'Biểu đồ cột',
  Briefcase: 'Cặp công tác', 'Gem stone': 'Đá quý', Receipt: 'Hoá đơn',
  'Shopping cart': 'Xe đẩy', 'Balance scale': 'Cân công lý', Abacus: 'Bàn tính',
  'Money-mouth face': 'Mặt hám tiền', 'Chart increasing with yen': 'Chứng khoán',
  'Convenience store': 'Cửa hàng', 'Shopping bags': 'Túi mua sắm', Ledger: 'Sổ cái',
  Fox: 'Cáo', Dragon: 'Rồng', Lion: 'Sư tử', Turtle: 'Rùa', Whale: 'Cá voi', Unicorn: 'Kỳ lân',
  Owl: 'Cú', Octopus: 'Bạch tuộc', Panda: 'Gấu trúc', Eagle: 'Đại bàng', 'Cat face': 'Mèo',
  'Dog face': 'Chó', 'Tiger face': 'Hổ', Wolf: 'Sói', Bear: 'Gấu', 'Rabbit face': 'Thỏ',
  'Monkey face': 'Khỉ', Penguin: 'Chim cánh cụt', Frog: 'Ếch', Hamster: 'Chuột hamster',
  Koala: 'Gấu koala', Butterfly: 'Bướm', Honeybee: 'Ong', Dolphin: 'Cá heo',
  'Grinning face': 'Mặt cười', 'Smiling face with sunglasses': 'Đeo kính râm',
  'Star-struck': 'Mắt ngôi sao', 'Face with tears of joy': 'Cười ra nước mắt',
  'Smiling face with heart-eyes': 'Mắt trái tim', 'Winking face': 'Nháy mắt',
  'Thinking face': 'Đang nghĩ', 'Nerd face': 'Mọt sách', 'Partying face': 'Quẩy',
  'Cowboy hat face': 'Cao bồi', 'Zany face': 'Điên khùng', 'Smiling face with halo': 'Thiên thần',
  'Hugging face': 'Ôm', 'Shushing face': 'Suỵt', 'Face with monocle': 'Kính một mắt',
  'Smirking face': 'Cười khẩy', 'Sleeping face': 'Đang ngủ', 'Exploding head': 'Nổ não',
  Rocket: 'Tên lửa', 'Glowing star': 'Ngôi sao', 'Crystal ball': 'Cầu pha lê',
  'Crescent moon': 'Trăng lưỡi liềm', 'High voltage': 'Tia chớp', 'Top hat': 'Mũ phép',
  'Four leaf clover': 'Cỏ bốn lá', Rainbow: 'Cầu vồng', 'Artist palette': 'Bảng vẽ',
  Fire: 'Lửa', Sparkles: 'Lấp lánh', Sun: 'Mặt trời', Trophy: 'Cúp', Crown: 'Vương miện',
  Ring: 'Nhẫn', Key: 'Chìa khoá', 'Light bulb': 'Bóng đèn', 'Locked with key': 'Ổ khoá',
  Shield: 'Khiên', Bullseye: 'Hồng tâm', Compass: 'La bàn', 'Hourglass done': 'Đồng hồ cát',
  'Bubble tea': 'Trà sữa', Hamburger: 'Bánh mì kẹp', Pizza: 'Pizza', Sushi: 'Sushi',
  'Birthday cake': 'Bánh sinh nhật', 'Hot beverage': 'Cà phê', Cookie: 'Bánh quy',
  'Ice cream': 'Kem', Watermelon: 'Dưa hấu', Strawberry: 'Dâu tây', 'Steaming bowl': 'Tô phở',
  Doughnut: 'Bánh vòng',
  'Party popper': 'Pháo giấy', Balloon: 'Bóng bay', 'Wrapped gift': 'Quà',
  'Confetti ball': 'Bóng kim tuyến', 'Red envelope': 'Lì xì', Firecracker: 'Pháo',
  'Christmas tree': 'Cây thông', Sparkler: 'Pháo bông', Ribbon: 'Nơ',
  'Military medal': 'Huân chương',
};

const CAT_ORDER = ['money', 'animal', 'face', 'symbol', 'food', 'party'];
const lines = manifest
  .slice()
  .sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat))
  .map((m) => `  { id: '${m.id}', label: '${VI[m.name] ?? m.name}', cat: '${m.cat}' },`)
  .join('\n');

const ts = `/* ═══ Fluent Emoji 3D pack — TỆP SINH TỰ ĐỘNG, ĐỪNG SỬA TAY ═══
 *
 * Nguồn: microsoft/fluentui-emoji (MIT). Xem public/emoji/LICENSE.md.
 * Sinh lại: node scripts/fetch-emoji-pack.mjs <tree.json> public/emoji/fluent3d
 */

export type FluentEmojiCat = ${CAT_ORDER.map((c) => `'${c}'`).join(' | ')};

export interface FluentEmojiIcon {
  /** Trùng tên file: public/emoji/fluent3d/<id>.webp */
  id: string;
  label: string;
  cat: FluentEmojiCat;
}

export const FLUENT_EMOJI_CATS: readonly { id: FluentEmojiCat; label: string; icon: string }[] = [
  { id: 'money', label: 'Tiền bạc', icon: 'money-bag' },
  { id: 'animal', label: 'Con vật', icon: 'fox' },
  { id: 'face', label: 'Mặt cười', icon: 'grinning-face' },
  { id: 'symbol', label: 'Biểu tượng', icon: 'glowing-star' },
  { id: 'food', label: 'Ăn uống', icon: 'bubble-tea' },
  { id: 'party', label: 'Lễ hội', icon: 'party-popper' },
] as const;

export const FLUENT_EMOJI_ICONS: readonly FluentEmojiIcon[] = [
${lines}
] as const;

/** Đường dẫn ảnh cho một icon id. */
export function fluentEmojiSrc(id: string): string {
  return \`/emoji/fluent3d/\${id}.webp\`;
}
`;
await fs.writeFile('src/data/fluentEmojiPack.ts', ts);
console.log('→ wrote src/data/fluentEmojiPack.ts');
