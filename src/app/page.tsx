/* ═══ Root Page — Redirect to login or overview ═══ */
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
}
