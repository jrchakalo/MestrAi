'use client';

import { useRouter } from 'next/navigation';
import { CampaignWizard } from '../../../pages/CampaignWizard';
import { Campaign, CampaignStatus } from '../../../types';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

export default function NewCampaignPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const key = localStorage.getItem('user_groq_key') || '';
      setApiKey(key);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push('/auth');
        return;
      }
      setUserId(sessionData.session.user.id);
    };
    init();
  }, [router]);

  const handleSave = async (camp: Campaign) => {
    if (!userId) return;
    const storedKey = localStorage.getItem('user_groq_key') || '';
    const effectiveKey = (apiKey || storedKey).trim();
    if (!effectiveKey) {
      alert('Chave da IA ausente. Insira uma chave válida para concluir a criação.');
      router.push('/setup-key');
      return;
    }
    if (effectiveKey !== apiKey) {
      setApiKey(effectiveKey);
    }

    let inferred: Record<string, any> | null = null;
    try {
      const res = await fetch('/api/character-infer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveKey ? { 'x-custom-api-key': effectiveKey } : {}),
        },
        body: JSON.stringify({
          systemName: camp.systemName,
          name: camp.characterName,
          appearance: camp.characterAppearance,
          backstory: camp.characterBackstory,
          profession: (camp as any).characterProfession || '',
        }),
      });

      if (res.status === 401) {
        const payload = await res.json().catch(() => ({}));
        if (payload?.error === 'Missing API key') {
          alert('Sua chave da IA não foi enviada. Verifique se ela está salva e tente novamente.');
        } else {
          alert('Não foi possível validar sua chave da IA. Verifique e tente novamente.');
        }
        router.push('/setup-key');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        inferred = data.character || null;
      }
    } catch (e) {
      console.error(e);
    }

    if (!inferred?.attributes || !inferred?.class_or_role || inferred?.hp === undefined) {
      alert('Não foi possível concluir a criação da ficha após tentativas internas. Tente novamente.');
      return;
    }

    const { data: created, error } = await supabase
      .from('campaigns')
      .insert({
        owner_id: userId,
        title: camp.title,
        description: camp.description,
        genre: camp.genre,
        system_name: camp.systemName,
        visual_style: camp.visualStyle,
        world_bible_json: { worldHistory: camp.worldHistory },
        status: CampaignStatus.WAITING,
        max_players: 5,
      })
      .select('id')
      .single();

    if (error || !created?.id) {
      const code = (error as any)?.code;
      if (code === 'PGRST204' || code === 'PGRST205') {
        alert('Banco não atualizado. Aplique o schema em Supabase (campaigns/campaign_players).');
      } else {
        alert('Não foi possível criar a mesa.');
      }
      return;
    }

    await supabase.from('campaign_players').insert({
      campaign_id: created.id,
      player_id: userId,
      character_name: camp.characterName,
      character_data_json: {
        appearance: camp.characterAppearance,
        backstory: camp.characterBackstory,
          profession: (camp as any).characterProfession || '',
        avatarUrl: camp.avatarUrl || null,
        inferred: inferred || undefined,
      },
      status: 'accepted',
      is_turn_active: true,
    });

    router.push(`/campaigns/${created.id}`);
  };

  return (
    <CampaignWizard
      apiKey={apiKey}
      onSave={handleSave}
      onCancel={() => router.push('/dashboard')}
    />
  );
}
