'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Dashboard } from '../../pages/Dashboard';
import { Campaign, CampaignStatus } from '../../types';
import { normalizeSystemName } from '../../constants';
import React, { useEffect, useState, Suspense } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Toast } from '../../components/ui/Toast';

function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const notice = searchParams?.get('notice');
    if (!notice) return;
    if (notice === 'denied') {
      setToast({ msg: 'Seu pedido para entrar na mesa foi negado. Você pode tentar novamente.', type: 'error' });
    }
    if (notice === 'banned') {
      setToast({ msg: 'Você foi banido desta mesa e não poderá entrar novamente.', type: 'error' });
    }
    if (notice === 'deleted') {
      setToast({ msg: 'A mesa foi excluída pelo mestre.', type: 'error' });
    }
  }, [searchParams]);

  const loadCampaigns = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      router.push('/auth');
      return;
    }

    const userId = sessionData.session.user.id;
    const { data, error } = await supabase
      .from('campaign_players')
      .select(
        'campaign_id, character_name, character_data_json, campaigns:campaigns(id,owner_id,title,description,genre,system_name,visual_style,world_bible_json,status,max_players,created_at)'
      )
      .eq('player_id', userId);

    if (error) {
      const code = (error as any)?.code;
      if (code === 'PGRST204' || code === 'PGRST205') {
        alert('Banco não atualizado. Aplique o schema em Supabase (campaigns/campaign_players).');
      }
    }

    if (!error && data) {
      const mapped = data
        .map((row: any) => {
          const camp = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
          if (!camp) return null;
          const worldHistory = camp.world_bible_json?.worldHistory || '';
          const charData = row.character_data_json || {};
          const systemName = normalizeSystemName(camp.system_name || 'Narrativo');

          return {
            id: camp.id,
            ownerId: camp.owner_id,
            title: camp.title,
            description: camp.description || '',
            worldHistory,
            genre: camp.genre || '',
            systemName,
            visualStyle: camp.visual_style || '',
            characterName: row.character_name || '',
            characterAppearance: charData.appearance || '',
            characterBackstory: charData.backstory || '',
            avatarUrl: charData.avatarUrl || undefined,
            status: (camp.status || CampaignStatus.WAITING) as CampaignStatus,
            maxPlayers: camp.max_players || 5,
            createdAt: camp.created_at ? new Date(camp.created_at).getTime() : Date.now(),
          } as Campaign;
        })
        .filter(Boolean) as Campaign[];
      setCampaigns(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCampaigns();

    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_players' }, () => {
        loadCampaigns();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        loadCampaigns();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando campanhas...
      </div>
    );
  }

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <Dashboard
        campaigns={campaigns}
        onCreateNew={() => router.push('/campaigns/new')}
        onSelectCampaign={(id) => router.push(`/campaigns/${id}`)}
        onEditCampaign={async (id) => {
          const title = prompt('Novo título:');
          if (!title) return;
          const description = prompt('Nova descrição:') || '';
          const { error } = await supabase
            .from('campaigns')
            .update({ title: title.trim(), description: description.trim() })
            .eq('id', id);
          if (error) {
            alert('Não foi possível atualizar a mesa.');
            return;
          }
          loadCampaigns();
        }}
        onDeleteCampaign={async (id) => {
          const ok = confirm('Excluir esta mesa definitivamente?');
          if (!ok) return;
          const { error } = await supabase.from('campaigns').delete().eq('id', id);
          if (error) {
            alert('Não foi possível excluir a mesa.');
            return;
          }
          setCampaigns((prev) => prev.filter((c) => c.id !== id));
        }}
        onJoinById={(id) => router.push(`/campaigns/${id}/join`)}
        onLogout={async () => {
          await supabase.auth.signOut();
          router.push('/');
        }}
      />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Carregando campanhas...</div>}>
      <DashboardClient />
    </Suspense>
  );
}
