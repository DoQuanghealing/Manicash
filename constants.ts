
import { Category, User, Wallet, Budget } from './types';

export const USERS: User[] = [
  { id: 'u1', name: 'Alex', avatar: ' Foxes' },
  { id: 'u2', name: 'Sam', avatar: 'Pandas' },
];

export const INITIAL_WALLETS: Wallet[] = [
  { id: 'w1', userId: 'u1', name: "Alex's Stash", balance: 2450 },
  { id: 'w2', userId: 'u2', name: "Sam's Vault", balance: 3100 },
];

export const INITIAL_BUDGETS: Budget[] = [
  { category: Category.FOOD, limit: 600, spent: 0 },
  { category: Category.SHOPPING, limit: 300, spent: 0 },
  { category: Category.ENTERTAINMENT, limit: 200, spent: 0 },
  { category: Category.TRANSPORT, limit: 150, spent: 0 },
];

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.FOOD]: '#ef4444',
  [Category.TRANSPORT]: '#f59e0b',
  [Category.SHOPPING]: '#ec4899',
  [Category.BILLS]: '#6366f1',
  [Category.ENTERTAINMENT]: '#8b5cf6',
  [Category.INVESTMENT]: '#10b981',
  [Category.INCOME]: '#10b981',
  [Category.TRANSFER]: '#94a3b8',
  [Category.OTHER]: '#64748b',
};

export const BUTLER_PROMPTS = {
  MALE: "3D high-quality render of a male financial butler mascot, waist-up view. Character design: friendly, professional, modern tech-savvy style. He wears a sleek deep purple vest over a crisp white shirt, matching the app's brand colors. Short, neat hairstyle, wearing a stylish monocle or thin-frame glasses. One hand making a \"thumb up\" gesture or holding a floating holographic coin. Art style: Pixar-style 3D, soft cinematic lighting, vibrant colors. Background: Pure white or transparent. High-end fintech UI aesthetic, 4k resolution, clean edges.",
  FEMALE: "3D high-quality render of a female financial butler mascot, waist-up view. Character design: elegant, trustworthy, and modern. She wears a professional tailored suit in navy and purple accents, with a neat ponytail or a sophisticated bun. Friendly facial expression with a confident smile. Accessories: a small glowing ear-piece or a digital tablet showing a profit chart. Art style: Minimalist 3D isometric render, soft shadows, vibrant neon highlights. Background: Pure white or transparent. Premium mobile app mascot style, clean composition, 4k resolution."
};
