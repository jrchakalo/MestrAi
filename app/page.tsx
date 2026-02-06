'use client';

import { useRouter } from 'next/navigation';
import { LandingPage } from '../pages/LandingPage';

export default function HomePage() {
  const router = useRouter();

  return (
    <LandingPage
      onLogin={() => router.push('/auth')}
      onHowItWorks={() => router.push('/how-it-works')}
    />
  );
}
