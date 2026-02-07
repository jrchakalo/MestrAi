'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase/client';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { LoadingDots } from '../../../../components/ui/LoadingDots';
import { normalizeSystemName } from '../../../../constants';

export default function JoinCampaignPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const campaignId = params?.id;
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [campaign, setCampaign] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'accepted' | 'banned'>('idle');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerCount, setPlayerCount] = useState(0);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [backstory, setBackstory] = useState('');
  const [profession, setProfession] = useState('');

  const redirectWithNotice = (notice: 'denied' | 'banned') => {
    if (!campaignId) return;
    router.push(`/dashboard?notice=${notice}&campaignId=${campaignId}`);
  };

  useEffect(() => {
    const init = async () => {
      if (!campaignId) return;
      const key = localStorage.getItem('user_groq_key') || '';
      setApiKey(key);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        router.push('/auth');
        return;
      }
      setPlayerId(sessionData.session.user.id);

      const { data: existing } = await supabase
        .from('campaign_players')
        .select('campaign_id,status')
        .eq('campaign_id', campaignId)
        .eq('player_id', sessionData.session.user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'accepted') {
          router.push(`/campaigns/${campaignId}`);
          return;
        }
        if (existing.status === 'banned') {
          setStatus('banned');
          redirectWithNotice('banned');
          return;
        } else {
          setStatus('pending');
        }
      }

      const { data: camp, error: campError } = await supabase
        .rpc('get_campaign_public', { campaign_id: campaignId })
        .maybeSingle();

      const { data: counts } = await supabase
        .rpc('campaign_player_counts', { campaign_id: campaignId })
        .maybeSingle();

      const safeCounts = (counts || {}) as { pending_count?: number; accepted_count?: number };
      const total = (safeCounts.pending_count || 0) + (safeCounts.accepted_count || 0);
      setPlayerCount(total);

      if (campError) {
        setCampaign(null);
      } else {
        if (camp) {
          const normalized = normalizeSystemName((camp as any).system_name);
          setCampaign({ ...(camp as any), system_name: normalized });
        } else {
          setCampaign(null);
        }
      }
      setLoading(false);
    };

    init();
  }, [campaignId, router]);

  const callSuggest = async (type: string, payload: Record<string, any> = {}) => {
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-custom-api-key': apiKey } : {}),
      },
      body: JSON.stringify({ type, payload }),
    });

    if (!res.ok) throw new Error('Suggest request failed');
    const data = await res.json();
    return (data.text || '').toString();
  };

  const handleGenName = async () => {
    if (!campaign?.genre) {
      alert('Gênero não disponível para sugestão.');
      return;
    }
    setGeneratingField('name');
    try {
      const text = await callSuggest('suggestCharacterName', {
        genre: campaign.genre,
        system: campaign.system_name,
      });
      setName(text.replace(/["]+/g, '').trim());
    } catch (e) {
      console.error(e);
    }
    setGeneratingField(null);
  };

  const handleGenAppearance = async () => {
    if (!name.trim()) {
      alert('Preencha o Nome primeiro.');
      return;
    }
    setGeneratingField('appearance');
    try {
      const text = await callSuggest('suggestCharacterAppearance', {
        genre: campaign?.genre || '',
        name: name.trim(),
      });
      setAppearance(text.trim());
    } catch (e) {
      console.error(e);
    }
    setGeneratingField(null);
  };

  const handleGenBackstory = async () => {
    if (!name.trim()) {
      alert('Preencha o Nome primeiro.');
      return;
    }
    if (!appearance.trim() && !profession.trim()) {
      alert('Preencha Aparência ou Profissão primeiro.');
      return;
    }
    setGeneratingField('backstory');
    try {
      const worldHistory = campaign?.world_bible_json?.worldHistory || '';
      const text = await callSuggest('suggestCharacterBackstory', {
        name: name.trim(),
        appearance: appearance.trim(),
        profession: profession.trim(),
        worldHistory,
      });
      setBackstory(text.trim());
    } catch (e) {
      console.error(e);
    }
    setGeneratingField(null);
  };

  const handleGenProfession = async () => {
    if (!appearance.trim() && !backstory.trim()) {
      alert('Preencha Aparência ou Backstory primeiro.');
      return;
    }
    setGeneratingField('profession');
    try {
      const text = await callSuggest('suggestCharacterProfession', {
        appearance: appearance.trim(),
        backstory: backstory.trim(),
      });
      setProfession(text.trim());
    } catch (e) {
      console.error(e);
    }
    setGeneratingField(null);
  };

  const generateAvatar = async () => {
    if (!campaign?.visual_style || !appearance.trim()) {
      alert('Preencha a Aparência e aguarde o Estilo Visual.');
      return;
    }
    setGeneratingAvatar(true);
    try {
      const seed = Math.floor(Math.random() * 10000);
      const promptText = `${campaign.visual_style}, character portrait, ${appearance.trim()}, centered, high quality, variation ${seed}`;
      const url = `/api/image?prompt=${encodeURIComponent(promptText)}&seed=${seed}&width=512&height=512&users=0`;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setAvatarUrl(url);
        setGeneratingAvatar(false);
      };
      img.onerror = () => {
        setGeneratingAvatar(false);
      };
    } catch (e) {
      console.error(e);
      setGeneratingAvatar(false);
    }
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let messageChannel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId || !campaignId) return;

      channel = supabase
        .channel(`player-join:${campaignId}:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'campaign_players', filter: `campaign_id=eq.${campaignId}` },
          (payload) => {
            const row: any = payload.new;
            if (row?.player_id !== userId) return;
            if (row.status === 'accepted') {
              setStatus('accepted');
              router.push(`/campaigns/${campaignId}`);
            } else if (row.status === 'banned') {
              setStatus('banned');
              redirectWithNotice('banned');
            } else {
              setStatus('pending');
            }
          }
        )
        .subscribe();

      messageChannel = supabase
        .channel(`player-join-messages:${campaignId}:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaignId}` },
          (payload) => {
            const row: any = payload.new;
            const meta = row?.metadata || {};
            if (meta?.target_player_id !== userId) return;
            if (meta?.action === 'accept') {
              setStatus('accepted');
              router.push(`/campaigns/${campaignId}`);
              return;
            }
            if (meta?.action === 'reject_note') {
              setStatus('idle');
              redirectWithNotice('denied');
              return;
            }
            if (meta?.action === 'ban') {
              setStatus('banned');
              redirectWithNotice('banned');
            }
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (messageChannel) supabase.removeChannel(messageChannel);
    };
  }, [campaignId, router]);

  const handleJoin = async () => {
    if (!campaign || !name.trim() || !appearance.trim() || !backstory.trim()) return;
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
    if (playerCount >= (campaign.max_players || 5)) {
      alert('A mesa já atingiu o limite de jogadores.');
      return;
    }
    if (status === 'banned') {
      alert('Você foi banido desta mesa.');
      redirectWithNotice('banned');
      return;
    }
    if (status === 'pending') return;

    setJoining(true);
    try {
      const res = await fetch('/api/character-infer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveKey ? { 'x-custom-api-key': effectiveKey } : {}),
        },
        body: JSON.stringify({
          systemName: campaign.system_name,
          name: name.trim(),
          appearance: appearance.trim(),
          backstory: backstory.trim(),
          profession: profession.trim(),
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
      if (!res.ok) throw new Error('Erro na inferência');

      const data = await res.json();
      const character = data.character || {};
      const warn = Array.isArray(data.warnings) ? data.warnings : [];
      setWarnings(warn);

      if (!character?.attributes || !character?.class_or_role || character?.hp === undefined) {
        alert('Não foi possível concluir a criação da ficha após tentativas internas. Tente novamente.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Sessão inválida');

      await supabase.from('campaign_players').insert({
        campaign_id: campaign.id,
        player_id: userId,
        character_name: name.trim(),
        character_data_json: {
          appearance: appearance.trim(),
          backstory: backstory.trim(),
          profession: profession.trim(),
          inferred: character,
          avatarUrl: avatarUrl || null,
        },
        status: 'pending',
        is_turn_active: false,
      });

      await supabase.from('messages').insert({
        campaign_id: campaign.id,
        role: 'system',
        content: `[SISTEMA] ${name.trim()} solicitou entrada na mesa.`,
        metadata: { type: 'system', action: 'join_request' },
      });

      setStatus('pending');
    } catch (e) {
      console.error(e);
      alert('Não foi possível entrar na mesa.');
    } finally {
      setJoining(false);
    }
  };

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Entrar na Mesa</h1>
          <p className="text-slate-400 text-sm">{campaign.title} • {campaign.system_name}</p>
        </div>

        <div className="bg-purple-900/20 border border-purple-700/50 p-4 rounded text-sm text-purple-200">
          Após enviar seus dados, o mestre precisa aprovar sua entrada.
        </div>

        {status === 'pending' && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-sm text-yellow-200">
            Seu pedido foi enviado. Aguarde a aprovação do mestre.
          </div>
        )}

        {status === 'banned' && (
          <div className="bg-red-900/20 border border-red-700/50 p-4 rounded text-sm text-red-200">
            Você foi banido desta mesa.
          </div>
        )}

        <div className="relative">
          <Input label="Nome do Personagem" value={name} onChange={(e) => setName(e.target.value)} disabled={status !== 'idle'} />
          <button
            type="button"
            onClick={handleGenName}
            disabled={status !== 'idle' || generatingField === 'name'}
            className="absolute right-2 top-8 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-1 rounded transition-colors"
          >
            {generatingField === 'name' ? <LoadingDots className="text-purple-200" /> : '✨ IA'}
          </button>
        </div>

        <div className="relative">
          <label className="text-sm font-medium text-slate-300 mb-1 block">Aparência Física</label>
          <textarea
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-24 focus:ring-2 focus:ring-purple-500"
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            disabled={status !== 'idle'}
          />
          <button
            type="button"
            onClick={handleGenAppearance}
            disabled={status !== 'idle' || generatingField === 'appearance'}
            className="absolute right-2 top-8 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-1 rounded transition-colors"
          >
            {generatingField === 'appearance' ? <LoadingDots className="text-purple-200" /> : '✨ IA'}
          </button>
        </div>

        <div className="relative">
          <Input
            label="Profissão/Ocupação (opcional)"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            disabled={status !== 'idle'}
          />
          <button
            type="button"
            onClick={handleGenProfession}
            disabled={status !== 'idle' || generatingField === 'profession'}
            className="absolute right-2 top-8 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-1 rounded transition-colors"
          >
            {generatingField === 'profession' ? <LoadingDots className="text-purple-200" /> : '✨ IA'}
          </button>
        </div>

        <div className="relative">
          <label className="text-sm font-medium text-slate-300 mb-1 block">Backstory</label>
          <textarea
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-28 focus:ring-2 focus:ring-purple-500"
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            disabled={status !== 'idle'}
          />
          <button
            type="button"
            onClick={handleGenBackstory}
            disabled={status !== 'idle' || generatingField === 'backstory'}
            className="absolute right-2 top-8 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-1 rounded transition-colors"
          >
            {generatingField === 'backstory' ? <LoadingDots className="text-purple-200" /> : '✨ IA'}
          </button>
        </div>

        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="w-40 h-40 rounded-xl border border-slate-700 object-cover" />
          ) : (
            <div className="w-40 h-40 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500">
              ?
            </div>
          )}
          <Button
            variant="outline"
            onClick={generateAvatar}
            isLoading={generatingAvatar}
            disabled={status !== 'idle' || !appearance.trim()}
          >
            Gerar avatar
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>Cancelar</Button>
          <Button onClick={handleJoin} isLoading={joining} disabled={joining || status !== 'idle' || !name.trim() || !appearance.trim() || !backstory.trim()}>
            Entrar na Mesa
          </Button>
        </div>
        {warnings.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-xs text-yellow-200">
            <p className="font-semibold mb-2">Avisos da ficha:</p>
            <ul className="list-disc list-inside">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
