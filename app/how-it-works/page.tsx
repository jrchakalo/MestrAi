'use client';

import { useRouter } from 'next/navigation';
import { HowItWorks } from '../../pages/HowItWorks';

export default function HowItWorksPage() {
  const router = useRouter();
  return <HowItWorks onBack={() => router.push('/')} />;
}
