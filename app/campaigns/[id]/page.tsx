'use client';

import { useRouter, useParams } from 'next/navigation';
import { GameSession } from '../../../pages/GameSession';
import { Campaign, CampaignStatus } from '../../../types';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

export default function CampaignSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [playerStatus, setPlayerStatus] = useState<string>('accepted');
  const [fixingCharacter, setFixingCharacter] = useState(false);
  const reInferAttemptedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (!campaignId) return;
      const key = localStorage.getItem('user_groq_key') || '';
      setApiKey(key);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push('/auth');
        return;
      }

      const userId = sessionData.session.user.id;
      const { data, error } = await supabase
        .from('campaign_players')
        .select(
          'campaign_id, status, character_name, character_data_json, campaigns:campaigns(id,owner_id,title,description,genero,tom,magia,tech,visual_style,world_bible_json,status,max_players,created_at)'
        )
        .eq('campaign_id', campaignId)
        .eq('player_id', userId)
        .single();

      if (!error && data?.campaigns) {
        const camp = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;
        const worldHistory = camp.world_bible_json?.worldHistory || '';
        const charData = data.character_data_json || {};
        setPlayerStatus(data.status || 'accepted');

        setCampaign({
          id: camp.id,
          ownerId: camp.owner_id,
          title: camp.title,
          description: camp.description || '',
          worldHistory,
          genero: camp.genero || '',
          tom: camp.tom || '',
          magia: camp.magia || '',
          tech: camp.tech || '',
          visualStyle: camp.visual_style || '',
          characterName: data.character_name || '',
          characterAppearance: charData.appearance || '',
          characterBackstory: charData.backstory || '',
          characterProfession: charData.profession || '',
          characterData: charData.inferred || undefined,
          avatarUrl: charData.avatarUrl || undefined,
          status: (camp.status || CampaignStatus.WAITING) as CampaignStatus,
          maxPlayers: camp.max_players || 5,
          createdAt: camp.created_at ? new Date(camp.created_at).getTime() : Date.now(),
        } as Campaign);
      } else if (campaignId) {
        router.push(`/campaigns/${campaignId}/join`);
      }
      setLoading(false);
    };

    load();
  }, [campaignId, router]);

  useEffect(() => {
    const reInferIfMissing = async () => {
      if (!campaign || !apiKey || fixingCharacter) return;
      if (reInferAttemptedRef.current) return;
      const attrs = campaign.characterData?.attributes;
      if (attrs && Object.keys(attrs).length > 0) return;
      if (!campaign.characterName || !campaign.characterAppearance || !campaign.characterBackstory) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const storageKey = `infer-fixed:${campaign.id}:${userId}`;
      if (typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1') {
        return;
      }

      setFixingCharacter(true);
      reInferAttemptedRef.current = true;
      try {
        const res = await fetch('/api/character-infer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-custom-api-key': apiKey } : {}),
          },
          body: JSON.stringify({
            genero: campaign.genero,
            tom: campaign.tom,
            magia: campaign.magia,
            tech: campaign.tech,
            name: campaign.characterName,
            appearance: campaign.characterAppearance,
            backstory: campaign.characterBackstory,
          }),
        });

        if (!res.ok) return;
        const data = await res.json();
        const inferred = data.character || null;
        if (!inferred || !inferred.attributes) return;

        await supabase
          .from('campaign_players')
          .update({
            character_data_json: {
              appearance: campaign.characterAppearance,
              backstory: campaign.characterBackstory,
              avatarUrl: campaign.avatarUrl || null,
              inferred,
            },
          })
          .eq('campaign_id', campaign.id)
          .eq('player_id', userId);

        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, '1');
        }

        setCampaign({
          ...campaign,
          characterData: inferred,
        });
      } finally {
        setFixingCharacter(false);
      }
    };

    reInferIfMissing();
  }, [campaign, apiKey, fixingCharacter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando...
      </div>
    );
  }

  return (
    <GameSession
      campaign={campaign}
      apiKey={apiKey}
      playerStatus={playerStatus}
      onExit={() => router.push('/dashboard')}
    />
  );
}
