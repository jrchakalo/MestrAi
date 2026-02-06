'use client';

import { useRouter } from 'next/navigation';
import { SetupKey } from '../../pages/SetupKey';
import { Toast } from '../../components/ui/Toast';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export default function SetupKeyPage() {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.push('/auth');
        return;
      }
      setChecked(true);
    };
    check();
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
      <SetupKey
        onComplete={() => router.push('/dashboard')}
        showToast={(msg, type) => setToast({ msg, type })}
      />
    </div>
  );
}
