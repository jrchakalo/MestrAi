'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase/client';
import { Button } from '../../../../components/ui/Button';
import { CampaignStatus } from '../../../../types';

export default function CampaignAdminPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingPlayers, setPendingPlayers] = useState<Array<{ player_id: string; character_name: string }>>([]);
  const [acceptedPlayers, setAcceptedPlayers] = useState<Array<{ player_id: string; character_name: string }>>([]);
  const [auditLog, setAuditLog] = useState<Array<{ id: string; content: string; created_at: string; metadata?: any }>>([]);
  const [auditFilter, setAuditFilter] = useState<'actions' | 'all' | 'pause'>('actions');
  const [motd, setMotd] = useState<string>('');
  const [pendingCount, setPendingCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [bannedCount, setBannedCount] = useState(0);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(CampaignStatus.WAITING);

  useEffect(() => {
    const init = async () => {
      if (!campaignId) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push('/auth');
        return;
      }
      setUserId(sessionData.session.user.id);

      const { data: camp } = await supabase
        .from('campaigns')
        .select('id,owner_id,title,status,max_players')
        .eq('id', campaignId)
        .maybeSingle();

      if (!camp || camp.owner_id !== sessionData.session.user.id) {
        router.push(`/campaigns/${campaignId}`);
        return;
      }

      setCampaign(camp);
      setCampaignStatus((camp.status || CampaignStatus.WAITING) as CampaignStatus);
      setLoading(false);
    };

    init();
  }, [campaignId, router]);

  const loadCounts = async () => {
    if (!campaignId) return;
    const pending = await supabase
      .from('campaign_players')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    const accepted = await supabase
      .from('campaign_players')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'accepted');

    const banned = await supabase
      .from('campaign_players')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'banned');

    setPendingCount(pending.count || 0);
    setAcceptedCount(accepted.count || 0);
    setBannedCount(banned.count || 0);
  };

  const loadPending = async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('campaign_players')
      .select('player_id, character_name')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');
    setPendingPlayers((data as any) || []);
  };

  const loadAccepted = async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('campaign_players')
      .select('player_id, character_name')
      .eq('campaign_id', campaignId)
      .eq('status', 'accepted');
    setAcceptedPlayers((data as any) || []);
  };

  const loadAudit = async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('messages')
      .select('id, content, created_at, metadata')
      .eq('campaign_id', campaignId)
      .eq('role', 'system')
      .order('created_at', { ascending: false })
      .limit(50);
    const filtered = auditFilter === 'actions'
      ? (data || []).filter((d: any) => d.metadata?.action)
      : auditFilter === 'pause'
        ? (data || []).filter((d: any) => ['pause', 'resume'].includes(d.metadata?.action))
        : (data || []);
    setAuditLog(filtered as any);
  };

  const loadMotd = async () => {
    if (!campaignId) return;
    const { data } = await supabase
      .from('messages')
      .select('content')
      .eq('campaign_id', campaignId)
      .eq('role', 'system')
      .contains('metadata', { action: 'motd' })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setMotd(data?.content || '');
  };

  useEffect(() => {
    if (!campaignId) return;
    loadCounts();
    loadPending();
    loadAccepted();
    loadAudit();
    loadMotd();

    const channel = supabase
      .channel(`admin:${campaignId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_players', filter: `campaign_id=eq.${campaignId}` }, () => {
        loadCounts();
        loadPending();
        loadAccepted();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaignId}` }, () => {
        loadAudit();
        loadMotd();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, (payload) => {
        const row: any = payload.new;
        if (row?.status) setCampaignStatus(row.status as CampaignStatus);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, auditFilter]);

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined' || !campaignId) return '';
    return `${window.location.origin}/campaigns/${campaignId}/join`;
  }, [campaignId]);

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
        Campanha não encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Administração da Mesa</h1>
            <p className="text-slate-400 text-sm">{campaign.title}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const nextStatus = campaignStatus === CampaignStatus.ACTIVE ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;
                const reason = nextStatus === CampaignStatus.PAUSED ? (prompt('Motivo da pausa (opcional):') || '') : '';
                const resumeReason = nextStatus === CampaignStatus.ACTIVE ? (prompt('Motivo da retomada (opcional):') || '') : '';
                supabase.from('campaigns').update({ status: nextStatus }).eq('id', campaignId).then(() => {
                  if (nextStatus === CampaignStatus.PAUSED) {
                    supabase.from('messages').insert({
                      campaign_id: campaignId,
                      role: 'system',
                      content: `[SISTEMA] Chat pausado. ${reason ? `Motivo: ${reason}` : ''}`.trim(),
                      metadata: { type: 'system', action: 'pause', reason: reason || null },
                    });
                  } else {
                    supabase.from('messages').insert({
                      campaign_id: campaignId,
                      role: 'system',
                      content: `[SISTEMA] Chat retomado. ${resumeReason ? `Motivo: ${resumeReason}` : ''}`.trim(),
                      metadata: { type: 'system', action: 'resume', reason: resumeReason || null },
                    });
                  }
                });
              }}
            >
              {campaignStatus === CampaignStatus.ACTIVE ? 'Pausar' : 'Retomar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!inviteLink) return;
                navigator.clipboard?.writeText(inviteLink);
              }}
            >
              Copiar convite
            </Button>
            <Button variant="outline" onClick={() => router.push(`/campaigns/${campaignId}`)}>
              Voltar ao jogo
            </Button>
          </div>
        </header>

        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Resumo da Mesa</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-950/60 border border-slate-800 rounded p-2">
              <span className="text-xs text-slate-500">Pendentes</span>
              <p className="text-slate-200 font-semibold">{pendingCount}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded p-2">
              <span className="text-xs text-slate-500">Aceitos</span>
              <p className="text-slate-200 font-semibold">{acceptedCount}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded p-2">
              <span className="text-xs text-slate-500">Banidos</span>
              <p className="text-slate-200 font-semibold">{bannedCount}</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">Mensagem do Mestre</h3>
              {motd && <p className="text-xs text-slate-400 mt-1">{motd.replace('[SISTEMA] ', '')}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const message = prompt('Mensagem do Mestre (fixar no topo):') || '';
                  if (!message.trim()) return;
                  supabase.from('messages').insert({
                    campaign_id: campaignId,
                    role: 'system',
                    content: `[SISTEMA] ${message.trim()}`,
                    metadata: { type: 'system', action: 'motd' },
                  });
                }}
              >
                Definir mensagem
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  supabase.from('messages').insert({
                    campaign_id: campaignId,
                    role: 'system',
                    content: '[SISTEMA] Mensagem do mestre removida.',
                    metadata: { type: 'system', action: 'motd' },
                  });
                }}
              >
                Remover
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-300">Pedidos para entrar</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const reason = prompt('Motivo da aprovação em massa (opcional):') || '';
                const remaining = (campaign.max_players || 5) - acceptedCount;
                const toAccept = pendingPlayers.slice(0, Math.max(0, remaining));
                toAccept.forEach((p) => {
                  supabase
                    .from('campaign_players')
                    .update({ status: 'accepted' })
                    .eq('campaign_id', campaignId)
                    .eq('player_id', p.player_id)
                    .then(() => {
                      supabase.from('messages').insert({
                        campaign_id: campaignId,
                        role: 'system',
                        content: '',
                        metadata: { type: 'system', action: 'accept', target_player_id: p.player_id, reason: reason || null },
                      });
                    });
                });
              }}
            >
              Aceitar todos
            </Button>
          </div>
          <div className="space-y-2">
            {pendingPlayers.length === 0 && (
              <p className="text-xs text-slate-500">Sem pendências.</p>
            )}
            {pendingPlayers.map((p) => (
              <div key={p.player_id} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-200 text-sm">{p.character_name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const reason = prompt('Motivo da aprovação (opcional):') || '';
                      supabase
                        .from('campaign_players')
                        .update({ status: 'accepted' })
                        .eq('campaign_id', campaignId)
                        .eq('player_id', p.player_id)
                        .then(() => {
                          supabase.from('messages').insert({
                            campaign_id: campaignId,
                            role: 'system',
                            content: '',
                            metadata: { type: 'system', action: 'accept', target_player_id: p.player_id, reason: reason || null },
                          });
                        });
                    }}
                  >
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason = prompt('Motivo da recusa (opcional):') || '';
                      supabase
                        .from('campaign_players')
                        .delete()
                        .eq('campaign_id', campaignId)
                        .eq('player_id', p.player_id)
                        .then(async () => {
                          await supabase.from('messages').insert({
                            campaign_id: campaignId,
                            role: 'system',
                            content: '',
                            metadata: { type: 'system', action: 'reject_note', target_player_id: p.player_id, reason: reason || null },
                          });
                        });
                    }}
                  >
                    Recusar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      const reason = prompt('Motivo da recusa/banimento (opcional):') || '';
                      supabase
                        .from('campaign_players')
                        .update({ status: 'banned' })
                        .eq('campaign_id', campaignId)
                        .eq('player_id', p.player_id)
                        .then(() => {
                          supabase.from('messages').insert({
                            campaign_id: campaignId,
                            role: 'system',
                            content: `[SISTEMA] ${p.character_name} foi recusado/banido da mesa. ${reason ? `Motivo: ${reason}` : ''}`.trim(),
                            metadata: { type: 'system', action: 'ban', target_player_id: p.player_id, reason: reason || null },
                          });
                        });
                    }}
                  >
                    Banir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Jogadores aceitos</h3>
          <div className="space-y-2">
            {acceptedPlayers.length === 0 && (
              <p className="text-xs text-slate-500">Nenhum jogador aceito.</p>
            )}
            {acceptedPlayers.map((p) => (
              <div key={p.player_id} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-slate-200 text-sm">{p.character_name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt('Motivo da remoção (opcional):') || '';
                    supabase
                      .from('campaign_players')
                      .update({ status: 'banned' })
                      .eq('campaign_id', campaignId)
                      .eq('player_id', p.player_id)
                      .then(() => {
                        supabase.from('messages').insert({
                          campaign_id: campaignId,
                          role: 'system',
                          content: `[SISTEMA] ${p.character_name} foi removido da mesa. ${reason ? `Motivo: ${reason}` : ''}`.trim(),
                          metadata: { type: 'system', action: 'remove', target_player_id: p.player_id, reason: reason || null },
                        });
                      });
                  }}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Log de Moderação</h3>
            <div className="flex gap-2">
              <Button size="sm" variant={auditFilter === 'actions' ? 'secondary' : 'outline'} onClick={() => setAuditFilter('actions')}>
                Ações
              </Button>
              <Button size="sm" variant={auditFilter === 'pause' ? 'secondary' : 'outline'} onClick={() => setAuditFilter('pause')}>
                Pausas
              </Button>
              <Button size="sm" variant={auditFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setAuditFilter('all')}>
                Tudo
              </Button>
            </div>
          </div>
          {auditLog.length === 0 ? (
            <p className="text-xs text-slate-500">Sem registros.</p>
          ) : (
            <div className="space-y-2 text-xs text-slate-300">
              {auditLog.map((entry) => (
                <div key={entry.id} className="bg-slate-950/60 border border-slate-800 rounded p-2">
                  <p className="text-slate-200">{entry.content}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{new Date(entry.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
