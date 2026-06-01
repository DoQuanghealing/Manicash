import { Suspense } from 'react';
import ProfileContent from './_components/ProfileContent';

export const metadata = {
  title: 'Hồ sơ | ManiCash',
  description: 'Hồ sơ và thành tựu cá nhân',
};

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}
