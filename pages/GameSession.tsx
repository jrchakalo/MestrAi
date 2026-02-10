import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Campaign, Message, Role, DiceRollRequest, CampaignStatus, CharacterSheet, AttributeName, HealthTier } from '../types';
import { Button } from '../components/ui/Button';
import { DiceRoller } from '../components/DiceRoller';
import { Input } from '../components/ui/Input';
import { supabase } from '../lib/supabaseClient';
import { Toast } from '../components/ui/Toast';
import { calculateRoll, applyDamage, applyRest } from '../lib/gameRules';
import { useTypewriter } from '../hooks/useTypewriter';

interface GameSessionProps {
  campaign: Campaign;
  apiKey: string;
  playerStatus?: string;
  onExit: () => void;
}

interface DeathState {
  isDead: boolean;
  cause: string;
  future: string;
}

interface TypewriterMarkdownProps {
  text: string;
  onDone?: () => void;
  onTick?: () => void;
}

const TypewriterMarkdown: React.FC<TypewriterMarkdownProps> = ({ text, onDone, onTick }) => {
  const typed = useTypewriter(text, { enabled: true, speedMs: 10, onDone, onTick });
  return (
    <div className="prose prose-invert prose-sm md:prose-base leading-relaxed break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {typed}
      </ReactMarkdown>
    </div>
  );
};

export const GameSession: React.FC<GameSessionProps> = ({ campaign, apiKey: initialApiKey, playerStatus = 'accepted', onExit }) => {
  const STREAMING_ENABLED = false;
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [diceRequest, setDiceRequest] = useState<{ req: DiceRollRequest, callId: string } | null>(null);
  const [deathState, setDeathState] = useState<DeathState | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(campaign.status);
  const [pendingPlayers, setPendingPlayers] = useState<Array<{ player_id: string; character_name: string }>>([]);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [localPlayerStatus, setLocalPlayerStatus] = useState<string>(playerStatus);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [acceptedPlayers, setAcceptedPlayers] = useState<Array<{ player_id: string; character_name: string }>>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [acceptedCount, setAcceptedCount] = useState<number>(0);
  const [bannedCount, setBannedCount] = useState<number>(0);
  const [connectedCount, setConnectedCount] = useState<number>(0);
  const [auditFilter, setAuditFilter] = useState<'actions' | 'all' | 'pause'>('actions');
  const [accessToken, setAccessToken] = useState<string>('');
  const [pauseReason, setPauseReason] = useState<string>('');
  const [motd, setMotd] = useState<string>('');
  const [auditLog, setAuditLog] = useState<Array<{ id: string; content: string; created_at: string; metadata?: any }>>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [turnState, setTurnState] = useState<{
    active: boolean;
    turnId: string | null;
    order: string[];
    orderNames: string[];
    currentIndex: number;
    actions: Array<{ playerId: string; name: string; text: string; roll?: number | null }>;
  }>({ active: false, turnId: null, order: [], orderNames: [], currentIndex: 0, actions: [] });
  const [turnRoll, setTurnRoll] = useState<number | null>(null);
  const [turnDiceRequest, setTurnDiceRequest] = useState<DiceRollRequest | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [characterData, setCharacterData] = useState<CharacterSheet | undefined>(campaign.characterData);
  const [startingCampaign, setStartingCampaign] = useState(false);
  const [rollDisplay, setRollDisplay] = useState<{ naturalRoll: number; outcomeLabel: string } | null>(null);
  const [healthDropPulse, setHealthDropPulse] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [typewriterMessageId, setTypewriterMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseNotice, setPauseNotice] = useState('Conexao com a IA interrompida. Verifique sua chave/creditos.');

  const HEALTH_LABELS: Record<HealthTier, string> = {
    HEALTHY: 'Saudavel',
    INJURED: 'Machucado -2',
    CRITICAL: 'Critico -5',
    DEAD: 'Morto',
  };

  const hasNarrativeMessages = (list: Message[]) =>
    list.some((m) => m.role === Role.USER || m.role === Role.MODEL);
  
  // Error States
  const [showKeyUpdateModal, setShowKeyUpdateModal] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startingRoundRef = useRef(false);
  const pendingMessagesRef = useRef<Message[] | null>(null);
  const initSentRef = useRef(false);
  const prevStatusRef = useRef<CampaignStatus | null>(null);
  const isAtBottomRef = useRef(true);
  const lastTypedMessageIdRef = useRef<string | null>(null);
  const initialScrollDoneRef = useRef(false);
  const processedImageCallsRef = useRef<Set<string>>(new Set());
  const diceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const getImageUrl = (msg: Message) => imageOverrides[msg.id] || msg.metadata?.imageUrl || '';

  const getDexValue = (player: any) => {
    const attrs = player?.character_data_json?.inferred?.attributes || player?.character_data_json?.attributes || {};
    const value = attrs.DESTREZA ?? attrs.destreza;
    return typeof value === 'number' ? value : Number(value) || 0;
  };

  const applyTurnMeta = (meta: any) => {
    if (!meta?.action) return;
    if (meta.action === 'turn_start') {
      setTurnState({
        active: true,
        turnId: meta.turn_id || null,
        order: Array.isArray(meta.order) ? meta.order : [],
        orderNames: Array.isArray(meta.order_names) ? meta.order_names : [],
        currentIndex: meta.current_index ?? 0,
        actions: [],
      });
      return;
    }
    if (meta.action === 'turn_action') {
      setTurnState((prev) => {
        if (!prev.active || prev.turnId !== meta.turn_id) return prev;
        const exists = prev.actions.some((a) => a.playerId === meta.player_id && a.text === meta.text);
        if (exists) return prev;
        return {
          ...prev,
          actions: [...prev.actions, {
            playerId: meta.player_id,
            name: meta.player_name || 'Jogador',
            text: meta.text || '',
            roll: meta.roll ?? null,
          }],
        };
      });
      return;
    }
    if (meta.action === 'turn_advance') {
      setTurnState((prev) => {
        if (!prev.active || prev.turnId !== meta.turn_id) return prev;
        return { ...prev, currentIndex: meta.current_index ?? prev.currentIndex };
      });
      return;
    }
    if (meta.action === 'turn_end') {
      setTurnState((prev) => {
        if (prev.turnId !== meta.turn_id) return prev;
        return { ...prev, active: false };
      });
    }
  };

  const rebuildTurnState = (history: Message[]) => {
    const lastStart = [...history].reverse().find((m) => m.metadata?.action === 'turn_start');
    if (!lastStart) return;
    const turnId = lastStart.metadata?.turn_id;
    if (!turnId) return;
    const order = Array.isArray(lastStart.metadata?.order) ? lastStart.metadata.order : [];
    const orderNames = Array.isArray(lastStart.metadata?.order_names) ? lastStart.metadata.order_names : [];
    const actions = history
      .filter((m) => m.metadata?.action === 'turn_action' && m.metadata?.turn_id === turnId)
      .map((m) => ({
        playerId: m.metadata?.player_id || 'unknown',
        name: m.metadata?.player_name || 'Jogador',
        text: m.metadata?.text || m.content || '',
        roll: m.metadata?.roll ?? null,
      }));
    const lastAdvance = [...history]
      .reverse()
      .find((m) => m.metadata?.action === 'turn_advance' && m.metadata?.turn_id === turnId);
    const lastEnd = [...history]
      .reverse()
      .find((m) => m.metadata?.action === 'turn_end' && m.metadata?.turn_id === turnId);
    const currentIndex = lastAdvance?.metadata?.current_index ?? lastStart.metadata?.current_index ?? 0;

    setTurnState({
      active: !lastEnd,
      turnId,
      order,
      orderNames,
      currentIndex,
      actions,
    });
  };

  const resizeInput = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 180);
    el.style.height = `${next}px`;
  };

  const scrollToBottom = () => {
    if (!scrollRef.current) return;
    const { scrollHeight } = scrollRef.current;
    scrollRef.current.scrollTo({ top: scrollHeight, behavior: 'auto' });
  };

  const pauseChat = (message: string) => {
    setIsPaused(true);
    setPauseNotice(message);
  };

  const TOOL_CODE_REGEX = /<tool_code>([\s\S]*?)<\/tool_code>/g;

  const extractToolCodeBlocks = (text: string) => {
    const actions: any[] = [];
    const cleaned = text.replace(TOOL_CODE_REGEX, (_match, jsonBlock) => {
      const raw = String(jsonBlock || '').trim();
      if (!raw) return '';
      try {
        const parsed = JSON.parse(raw);
        actions.push(parsed);
      } catch {
        return '';
      }
      return '';
    }).trim();
    return { cleaned, actions };
  };

  const normalizeToolAction = (actionBlock: any) => {
    const action = actionBlock?.action;
    const params = { ...(actionBlock?.params || actionBlock?.args || actionBlock?.parameters || {}) } as Record<string, any>;
    if (action === 'request_roll' && actionBlock?.params) {
      return { action, params: actionBlock.params };
    }
    if ((action === 'apply_damage' || action === 'apply_rest') && !params.type && actionBlock?.type) {
      params.type = actionBlock.type;
    }
    if (action === 'generate_image' && !params.prompt && actionBlock?.prompt) {
      params.prompt = actionBlock.prompt;
    }
    return { action, params };
  };

  const processToolCodeActions = async (actions: any[], baseMessages: Message[]) => {
    for (const block of actions) {
      const normalized = normalizeToolAction(block);
      if (!normalized.action) continue;
      await handleToolCalls(
        [
          {
            id: `tool_code_${normalized.action}_${Date.now()}`,
            name: normalized.action,
            args: normalized.params || {},
          },
        ],
        baseMessages
      );
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 48;
  };

  // --- Initialization ---
  useEffect(() => {
    const initChat = async () => {
      setCampaignStatus(campaign.status);
      const { data: sessionData } = await supabase.auth.getSession();
      setUserId(sessionData.session?.user?.id || null);
      setAccessToken(sessionData.session?.access_token || '');

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: true });

      if (error) {
        setToast({ msg: 'Falha ao carregar o chat. Tente novamente.', type: 'error' });
        return;
      }

      const initialHistory: Message[] = !error && data
        ? data.map((row: any) => {
            const role = row.role === 'assistant' ? Role.MODEL : row.role;
            const meta = row.metadata || {};
            const parsed = row.content ? extractToolCodeBlocks(row.content) : { cleaned: '', actions: [] };
            return {
              id: row.id,
              role,
              content: parsed.cleaned || '',
              timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              type: meta.type || (meta.imageUrl ? 'image' : 'text'),
              metadata: meta,
            } as Message;
          })
        : [];

      if (initialHistory.length > 0) setMessages(initialHistory);
      if (initialHistory.length > 0) rebuildTurnState(initialHistory);

      if (initialHistory.length > 0) {
        const lastModel = [...initialHistory]
          .reverse()
          .find((msg) => msg.role === Role.MODEL && msg.content && msg.type !== 'image');
        lastTypedMessageIdRef.current = lastModel?.id || null;
        setTypewriterMessageId(null);
      }

      const deathMsg = initialHistory.find(m => m.type === 'death_event');
      if (deathMsg) {
         setDeathState({ isDead: true, cause: 'Unknown', future: 'Already died' });
      }

      // Start sequence if new (only when active)
      if (!hasNarrativeMessages(initialHistory) && campaign.status !== CampaignStatus.WAITING) {
        initSentRef.current = true;
        await handleSendMessage(
          "Mestre, INICIE A AVENTURA. " +
          "1) Narre a introdução descrevendo onde estou, o ambiente e a situação inicial. " +
          "2) Ao final, liste 3 opções claras do que posso fazer. " +
          "Não gere imagens agora, foque na narrativa.", 
          true
        ); 
      }
      setHistoryLoaded(true);
    };
    initChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, apiKey]);

  useEffect(() => {
    setToast({ msg: `Bem-vindo a ${campaign.title}`, type: 'success' });
  }, [campaign.title]);

  useEffect(() => {
    if (campaignStatus !== CampaignStatus.ACTIVE) return;
    if (turnState.active) return;
    if (campaign.ownerId !== userId) return;
    if (acceptedCount === 0) return;
    if (startingRoundRef.current) return;

    startingRoundRef.current = true;
    startTurnRound(true)
      .catch(() => null)
      .finally(() => {
        startingRoundRef.current = false;
      });
  }, [campaignStatus, turnState.active, campaign.ownerId, userId, acceptedCount]);

  useEffect(() => {
    const loadCounts = async () => {
      const pending = await supabase
        .from('campaign_players')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      const accepted = await supabase
        .from('campaign_players')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'accepted');

      const banned = await supabase
        .from('campaign_players')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'banned');

      const pendingCountValue = pending.count || 0;
      const acceptedCountValue = accepted.count || 0;
      const bannedCountValue = banned.count || 0;

      setPendingCount(pendingCountValue);
      setAcceptedCount(acceptedCountValue);
      setBannedCount(bannedCountValue);
      setPlayerCount(pendingCountValue + acceptedCountValue);
    };

    loadCounts();

    const channel = supabase
      .channel(`campaign:${campaign.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaign.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setToast({ msg: 'A mesa foi excluída pelo mestre.', type: 'error' });
            window.location.href = '/dashboard?notice=deleted';
            return;
          }
          const row: any = payload.new;
          if (row?.status) setCampaignStatus(row.status as CampaignStatus);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_players', filter: `campaign_id=eq.${campaign.id}` },
        () => loadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`presence:${campaign.id}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setConnectedCount(count);
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setConnectedCount(count);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setConnectedCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online: true, at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`dice:${campaign.id}`)
      .on('broadcast', { event: 'dice_roll' }, ({ payload }) => {
        if (!payload || typeof payload.roll !== 'number') return;
        const label = payload.label || 'Rolagem registrada';
        setRollDisplay({ naturalRoll: payload.roll, outcomeLabel: label });
      })
      .subscribe();

    diceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      diceChannelRef.current = null;
    };
  }, [campaign.id]);

  useEffect(() => {
    const loadPauseReason = async () => {
      if (campaignStatus !== CampaignStatus.PAUSED) {
        setPauseReason('');
        return;
      }

      const { data } = await supabase
        .from('messages')
        .select('metadata')
        .eq('campaign_id', campaign.id)
        .eq('role', 'system')
        .contains('metadata', { action: 'pause' })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setPauseReason(data?.metadata?.reason || '');
    };

    loadPauseReason();
  }, [campaign.id, campaignStatus]);

  useEffect(() => {
    if (!prevStatusRef.current) {
      prevStatusRef.current = campaignStatus;
      return;
    }
    if (prevStatusRef.current !== campaignStatus) {
      if (campaignStatus === CampaignStatus.PAUSED) {
        setToast({ msg: 'Chat pausado', type: 'success' });
      }
      if (campaignStatus === CampaignStatus.ACTIVE && prevStatusRef.current === CampaignStatus.PAUSED) {
        setToast({ msg: 'Chat retomado', type: 'success' });
      }
      prevStatusRef.current = campaignStatus;
    }
  }, [campaignStatus]);

  useEffect(() => {
    const loadMotd = async () => {
      const { data } = await supabase
        .from('messages')
        .select('content')
        .eq('campaign_id', campaign.id)
        .eq('role', 'system')
        .contains('metadata', { action: 'motd' })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setMotd(data?.content || '');
    };

    loadMotd();
  }, [campaign.id]);

  useEffect(() => {
    const loadPending = async () => {
      if (campaign.ownerId !== userId) return;
      const { data } = await supabase
        .from('campaign_players')
        .select('player_id, character_name')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');
      if (data) setPendingPlayers(data as any);
    };

    const loadAccepted = async () => {
      if (campaign.ownerId !== userId) return;
      const { data } = await supabase
        .from('campaign_players')
        .select('player_id, character_name')
        .eq('campaign_id', campaign.id)
        .eq('status', 'accepted');
      if (data) setAcceptedPlayers(data as any);
    };

    loadPending();
    loadAccepted();

    const loadAudit = async () => {
      if (campaign.ownerId !== userId) return;
      const { data } = await supabase
        .from('messages')
        .select('id, content, created_at, metadata')
        .eq('campaign_id', campaign.id)
        .eq('role', 'system')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        const filtered = auditFilter === 'actions'
          ? data.filter((d: any) => d.metadata?.action)
          : auditFilter === 'pause'
            ? data.filter((d: any) => ['pause', 'resume'].includes(d.metadata?.action))
            : data;
        setAuditLog(filtered as any);
      }
    };

    loadAudit();

    const channel = supabase
      .channel(`players:${campaign.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_players', filter: `campaign_id=eq.${campaign.id}` },
        () => {
          loadPending();
          loadAccepted();
          loadAudit();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id, campaign.ownerId, userId, auditFilter]);

  useEffect(() => {
    if (!historyLoaded) return;
    if (campaignStatus === CampaignStatus.ACTIVE && !hasNarrativeMessages(messages) && !initSentRef.current) {
      initSentRef.current = true;
      handleSendMessage(
        "Mestre, INICIE A AVENTURA. " +
        "1) Narre a introdução descrevendo onde estou, o ambiente e a situação inicial. " +
        "2) Ao final, liste 3 opções claras do que posso fazer. " +
        "Não gere imagens agora, foque na narrativa.",
        true
      );
    }
  }, [campaignStatus, messages.length, historyLoaded]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, campaign.id]);

  useEffect(() => {
    if (!historyLoaded || messages.length === 0) return;
    if (initialScrollDoneRef.current) return;
    scrollToBottom();
    isAtBottomRef.current = true;
    initialScrollDoneRef.current = true;
  }, [historyLoaded, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [loading]);

  useEffect(() => {
    if (!historyLoaded || messages.length === 0) return;
    const lastModel = [...messages]
      .reverse()
      .find((msg) => msg.role === Role.MODEL && msg.content && msg.type !== 'image');

    if (!lastModel) {
      setTypewriterMessageId(null);
      lastTypedMessageIdRef.current = null;
      return;
    }

    if (lastTypedMessageIdRef.current === lastModel.id) return;
    lastTypedMessageIdRef.current = lastModel.id;
    setTypewriterMessageId(lastModel.id);
  }, [messages, historyLoaded]);


  useEffect(() => {
    resizeInput(inputRef.current);
  }, [input]);

  useEffect(() => {
    setLocalPlayerStatus(playerStatus);
  }, [playerStatus]);

  useEffect(() => {
    if (!userId) return;

    const refreshStatus = async () => {
      const { data } = await supabase
        .from('campaign_players')
        .select('status,is_dead,death_cause,death_world_future')
        .eq('campaign_id', campaign.id)
        .eq('player_id', userId)
        .maybeSingle();

      const status = data?.status || 'pending';
      setLocalPlayerStatus(status);
      if (status === 'banned') {
        setToast({ msg: 'Você foi banido desta mesa.', type: 'error' });
      }
      if (data?.is_dead) {
        setDeathState({
          isDead: true,
          cause: data?.death_cause || 'Causa desconhecida',
          future: data?.death_world_future || 'Futuro incerto',
        });
      }
    };

    refreshStatus();

    const channel = supabase
      .channel(`player-status:${campaign.id}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_players', filter: `campaign_id=eq.${campaign.id}` },
        (payload) => {
          const row: any = payload.new;
          if (row?.player_id !== userId) return;
          const oldRecord: any = payload.old || {};
          if (oldRecord.status === 'pending' && row.status === 'accepted') {
            setToast({ msg: 'Você foi aprovado na mesa!', type: 'success' });
          }
          refreshStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${campaign.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaign.id}` },
        (payload) => {
          const row: any = payload.new;
          const role = row.role === 'assistant' ? Role.MODEL : row.role;
          const meta = row.metadata || {};
          const msg: Message = {
            id: row.id,
            role,
            content: row.content || '',
            timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            type: meta.type || (meta.imageUrl ? 'image' : 'text'),
            metadata: meta,
          };
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          if (meta?.action) {
            applyTurnMeta(meta);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaign.id}` },
        (payload) => {
          const row: any = payload.new;
          const role = row.role === 'assistant' ? Role.MODEL : row.role;
          const meta = row.metadata || {};
          const parsed = row.content ? extractToolCodeBlocks(row.content) : { cleaned: '', actions: [] };
          setMessages((prev) => prev.map((m) => (
            m.id === row.id
              ? {
                  ...m,
                  role,
                  content: parsed.cleaned || m.content,
                  type: meta.type || (meta.imageUrl ? 'image' : m.type),
                  metadata: meta,
                }
              : m
          )));
          if (meta?.action) {
            applyTurnMeta(meta);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaign.id]);

  // --- Core Logic ---

  const persistMessage = async (msg: Message) => {
    if (!userId) return;
    const role = msg.role === Role.MODEL ? 'assistant' : msg.role;
    await supabase.from('messages').insert({
      id: msg.id,
      campaign_id: campaign.id,
      role,
      content: msg.content,
      metadata: { ...(msg.metadata || {}), type: msg.type || 'text' },
    });
  };

  const persistCharacter = async (nextData: CharacterSheet) => {
    if (!userId) return;
    const { data } = await supabase
      .from('campaign_players')
      .select('character_data_json')
      .eq('campaign_id', campaign.id)
      .eq('player_id', userId)
      .maybeSingle();

    const base = (data?.character_data_json || {}) as any;
    await supabase
      .from('campaign_players')
      .update({
        character_data_json: {
          ...base,
          inferred: nextData,
        },
      })
      .eq('campaign_id', campaign.id)
      .eq('player_id', userId);
  };

  const postAudit = async (content: string, metadata: Record<string, any>) => {
    await supabase.from('messages').insert({
      campaign_id: campaign.id,
      role: Role.SYSTEM,
      content,
      metadata: { type: 'system', ...metadata },
    });
  };

  const startTurnRound = async (force = false) => {
    if (!campaign.id || !campaign.ownerId || userId !== campaign.ownerId) return;
    if (!force && turnState.active) return;
    if (campaignStatus !== CampaignStatus.ACTIVE) return;

    const { data } = await supabase
      .from('campaign_players')
      .select('player_id, character_name, character_data_json')
      .eq('campaign_id', campaign.id)
      .eq('status', 'accepted');

    if (!data || data.length === 0) return;

    const players = data.map((p: any) => ({
      id: p.player_id,
      name: p.character_name || 'Jogador',
      dex: getDexValue(p),
    }));

    const sortedPlayers = players.sort((a, b) => {
      if (b.dex !== a.dex) return b.dex - a.dex;
      return Math.random() < 0.5 ? -1 : 1;
    });

    const sorted = sortedPlayers.map((p) => p.id);
    const orderNames = sortedPlayers.map((p) => p.name);
    const turnId = crypto.randomUUID();

    await supabase.from('messages').insert({
      campaign_id: campaign.id,
      role: Role.SYSTEM,
      content: '',
      metadata: {
        type: 'system',
        action: 'turn_start',
        turn_id: turnId,
        order: sorted,
        order_names: orderNames,
        current_index: 0,
        dex_key: 'DESTREZA',
      },
    });
  };

  const advanceTurnAfterResponse = async () => {
    if (!turnState.active || !turnState.turnId) return;

    const nextIndex = turnState.currentIndex + 1;
    if (nextIndex < turnState.order.length) {
      await supabase.from('messages').insert({
        campaign_id: campaign.id,
        role: 'system',
        content: '',
        metadata: {
          type: 'system',
          action: 'turn_advance',
          turn_id: turnState.turnId,
          current_index: nextIndex,
        },
      });
      return;
    }

    await supabase.from('messages').insert({
      campaign_id: campaign.id,
      role: 'system',
      content: '',
      metadata: {
        type: 'system',
        action: 'turn_end',
        turn_id: turnState.turnId,
      },
    });

    if (campaign.ownerId === userId && campaignStatus === CampaignStatus.ACTIVE) {
      await startTurnRound(true);
    }
  };

  const sendChat = async ({
    inputText,
    toolResponse,
    baseMessages,
    autoStartTurn = true,
  }: {
    inputText?: string;
    toolResponse?: { name: string; result: any; callId?: string; args?: any };
    baseMessages: Message[];
    autoStartTurn?: boolean;
  }) => {
    try {
      let token = accessToken;
      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData.session?.access_token || '';
        if (token) setAccessToken(token);
      }
      let effectiveKey = apiKey;
      if (!effectiveKey) {
        const stored = localStorage.getItem('user_groq_key') || '';
        effectiveKey = stored.trim();
        if (effectiveKey) {
          setApiKey(effectiveKey);
        }
      }
      const sanitizedMessages = baseMessages.filter((m) => m.type !== 'image' && !!m.content);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(STREAMING_ENABLED ? { Accept: 'text/event-stream', 'x-stream': '1' } : {}),
          ...(effectiveKey ? { 'x-custom-api-key': effectiveKey } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaign,
          messages: sanitizedMessages,
          input: inputText,
          toolResponse,
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const payload = await res.json().catch(() => ({}));
          const retryAfter = payload?.retryAfter ? Number(payload.retryAfter) : null;
          const msg = retryAfter
            ? `Limite de uso da IA atingido. Tente novamente em ${retryAfter}s.`
            : 'Limite de uso da IA atingido. Aguarde 1-2 minutos e tente novamente.';
          setToast({ msg, type: 'error' });
          pauseChat('Conexao com a IA interrompida. Limite de uso atingido.');
          return { hasToolCalls: false, didRespond: false };
        }
        if (res.status === 402 || res.status === 500) {
          pauseChat('Conexao com a IA interrompida. Verifique sua chave/creditos.');
          setToast({ msg: 'Falha ao gerar resposta. Tente novamente.', type: 'error' });
          return { hasToolCalls: false, didRespond: false };
        }
        if (res.status === 403) {
          setToast({ msg: 'Você não pode agir nesta mesa no momento.', type: 'error' });
          return { hasToolCalls: false, didRespond: false };
        }
        setToast({ msg: 'Falha ao gerar resposta. Tente novamente em instantes.', type: 'error' });
        pauseChat('Conexao com a IA interrompida. Tente novamente.');
        return { hasToolCalls: false, didRespond: false };
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let updatedMessages = baseMessages;
        const modelId = crypto.randomUUID();
        let hasModelMessage = false;
        let didRespond = false;

        const upsertModelMessage = (text: string) => {
          if (!hasModelMessage) {
            const modelMsg: Message = {
              id: modelId,
              role: Role.MODEL,
              content: text,
              timestamp: Date.now(),
            };
            updatedMessages = [...updatedMessages, modelMsg];
            setMessages(updatedMessages);
            hasModelMessage = true;
            return;
          }
          updatedMessages = updatedMessages.map((m) => (m.id === modelId ? { ...m, content: text } : m));
          setMessages(updatedMessages);
        };

        const handleStreamEvent = async (event: any) => {
          if (event?.type === 'token') {
            const tokenText = (event.value || '').toString();
            if (!tokenText) return;
            fullText += tokenText;
            upsertModelMessage(fullText);
            return;
          }
          if (event?.type === 'done') {
            const finalText = (event.text || fullText || '').toString();
            if (finalText) {
              const parsed = extractToolCodeBlocks(finalText);
              fullText = parsed.cleaned || '';
              if (fullText) {
                upsertModelMessage(fullText);
              }
              if (parsed.actions.length > 0) {
                await processToolCodeActions(parsed.actions, updatedMessages);
              }
            }
          }
          if (event?.type === 'error') {
            setToast({ msg: 'Falha ao gerar resposta. Tente novamente.', type: 'error' });
          }
        };

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundaryIndex = buffer.indexOf('\n\n');
            while (boundaryIndex !== -1) {
              const raw = buffer.slice(0, boundaryIndex).trim();
              buffer = buffer.slice(boundaryIndex + 2);
              boundaryIndex = buffer.indexOf('\n\n');

              if (!raw.startsWith('data:')) continue;
              const jsonLine = raw.replace(/^data:\s*/, '').trim();
              if (!jsonLine) continue;

              const event = JSON.parse(jsonLine);
              await handleStreamEvent(event);

              if (event?.type === 'done') {
                const finalToolCalls = Array.isArray(event.toolCalls) ? event.toolCalls : [];
                const hasImageTool = finalToolCalls.some((call: any) => call?.name === 'generate_image');
                if (hasModelMessage && fullText.trim()) {
                  if (hasImageTool) {
                    updatedMessages = updatedMessages.filter((m) => m.id !== modelId);
                    setMessages(updatedMessages);
                    fullText = '';
                  } else {
                    if (fullText.trim()) {
                      await persistMessage({
                        id: modelId,
                        role: Role.MODEL,
                        content: fullText,
                        timestamp: Date.now(),
                      });
                      didRespond = true;
                    }
                  }
                }

                const hasToolCalls = finalToolCalls.length > 0;
                if (hasToolCalls) {
                  await handleToolCalls(finalToolCalls, hasModelMessage ? updatedMessages : baseMessages);
                } else if (autoStartTurn && campaign.ownerId === userId && campaignStatus === CampaignStatus.ACTIVE && !turnState.active) {
                  await startTurnRound();
                }

                return { hasToolCalls, didRespond };
              }

              if (event?.type === 'error') {
                return { hasToolCalls: false, didRespond: false };
              }
            }
          }
        } catch (e) {
          console.error('Chat stream error:', e);
          setShowKeyUpdateModal(true);
          return { hasToolCalls: false, didRespond: false };
        }

        return { hasToolCalls: false, didRespond };
      }

      const data = await res.json();
      let updatedMessages = baseMessages;
      let didRespond = false;

      const hasToolCalls = Array.isArray(data.toolCalls) && data.toolCalls.length > 0;
      const hasImageTool = hasToolCalls && data.toolCalls.some((call: any) => call?.name === 'generate_image');

      if (data.text && data.text.trim() && !hasImageTool) {
        const parsed = extractToolCodeBlocks(data.text);
        if (parsed.cleaned) {
          const modelMsg: Message = {
            id: crypto.randomUUID(),
            role: Role.MODEL,
            content: parsed.cleaned,
            timestamp: Date.now(),
          };
          updatedMessages = [...updatedMessages, modelMsg];
          setMessages(updatedMessages);
          await persistMessage(modelMsg);
          didRespond = true;
        }
        if (parsed.actions.length > 0) {
          await processToolCodeActions(parsed.actions, updatedMessages);
        }
      }
      if (hasToolCalls) {
        await handleToolCalls(data.toolCalls, updatedMessages);
      } else if (autoStartTurn && campaign.ownerId === userId && campaignStatus === CampaignStatus.ACTIVE && !turnState.active) {
        await startTurnRound();
      }

      return { hasToolCalls, didRespond };
    } catch (e) {
      console.error('Chat error:', e);
      setShowKeyUpdateModal(true);
      pauseChat('Conexao com a IA interrompida. Verifique sua chave/creditos.');
      return { hasToolCalls: false, didRespond: false };
    }
  };

  const handleToolCalls = async (toolCalls: any[], baseMessages: Message[]) => {
    for (const call of toolCalls) {
      if (call.name === 'trigger_game_over') {
        const args = call.args as any;
        handleDeath(args.causeOfDeath, args.worldFuture);
        return;
      }

      if (call.name === 'request_roll') {
        if (diceRequest || turnDiceRequest) return;
        setDiceRequest({ req: call.args as DiceRollRequest, callId: call.id || call.name });
        pendingMessagesRef.current = baseMessages;
        return;
      }

      if (call.name === 'apply_damage') {
        const args = call.args as { type?: 'LIGHT' | 'HEAVY' };
        if (!characterData) return;
        const prevTier = characterData.health.tier;
        const next = applyDamage(characterData, args.type === 'HEAVY' ? 'HEAVY' : 'LIGHT');

        setCharacterData(next);
        if (prevTier !== next.health.tier) {
          setHealthDropPulse(true);
          setTimeout(() => setHealthDropPulse(false), 700);
        }
        await persistCharacter(next);

        if (next.health.tier === 'DEAD' && !deathState?.isDead) {
          await handleDeath('O corpo nao aguentou os ferimentos.', 'A historia segue sem o heroi, deixando ecos do que poderia ter sido.');
          return;
        }
        return;
      }

      if (call.name === 'apply_rest') {
        const args = call.args as { type?: 'SHORT' | 'LONG' };
        if (!characterData) return;
        const prevTier = characterData.health.tier;
        const next = applyRest(characterData, args.type === 'LONG' ? 'LONG' : 'SHORT');

        setCharacterData(next);
        if (prevTier !== next.health.tier) {
          setHealthDropPulse(true);
          setTimeout(() => setHealthDropPulse(false), 700);
        }
        await persistCharacter(next);
        return;
      }

      if (call.name === 'trigger_levelup') {
        const sysMsg: Message = {
          id: crypto.randomUUID(),
          role: Role.SYSTEM,
          content: '[SISTEMA] Evolucao rara ativada. O mestre vai narrar a mudanca.',
          timestamp: Date.now(),
        };
        const nextMessages = [...baseMessages, sysMsg];
        setMessages(nextMessages);
        await persistMessage(sysMsg);
        return;
      }

      if (call.name === 'generate_image') {
        const prompt = (call.args as any).prompt;
        const callId = call.id || `call_${call.name}`;
        if (processedImageCallsRef.current.has(callId)) return;
        if (baseMessages.some((msg) => msg.metadata?.imageUrl && msg.metadata?.sourceCallId === callId)) return;
        if (baseMessages.some((msg) => msg.metadata?.imageUrl && msg.metadata?.prompt === prompt)) return;
        processedImageCallsRef.current.add(callId);
        const visualStyle = campaign.visualStyle;
        const seed = Math.floor(Math.random() * 9999);
        const finalPrompt = `${visualStyle}. ${prompt}`;
        const users = connectedCount > 0 ? connectedCount : playerCount;
        const imageUrl = `/api/image?prompt=${encodeURIComponent(finalPrompt)}&seed=${seed}&width=768&height=512&users=${users}`;

        const imgMsg: Message = {
          id: crypto.randomUUID(),
          role: Role.SYSTEM,
          content: '',
          timestamp: Date.now(),
          type: 'image',
          metadata: { imageUrl, sourceCallId: callId, prompt },
        };

        const nextMessages = [...baseMessages, imgMsg];
        setMessages(nextMessages);
        await persistMessage(imgMsg);

        await sendChat({
          baseMessages: nextMessages,
          toolResponse: { name: 'generate_image', result: 'Image displayed successfully.', callId: call.id || call.name },
        });
        return;
      }

      if (call.name === 'update_character') {
        const updates = (call.args as any) || {};
        const nextData: CharacterSheet = {
          ...(characterData || {
            name: campaign.characterName,
            appearance: campaign.characterAppearance,
            profession: campaign.characterProfession || 'Sem profissao',
            backstory: campaign.characterBackstory,
            attributes: { VIGOR: 0, DESTREZA: 0, MENTE: 0, PRESENÇA: 0 },
            health: { tier: 'HEALTHY', lightDamageCounter: 0 },
            inventory: [],
          }),
          ...(updates.profession ? { profession: updates.profession } : {}),
          ...(Array.isArray(updates.inventory) ? { inventory: updates.inventory } : {}),
        };

        setCharacterData(nextData);
        await persistCharacter(nextData);
        return;
      }
    }
  };

  // --- Handlers ---

  const handleSendMessage = async (text: string, isSystemInit = false) => {
    if (isPaused && !isSystemInit) {
      setToast({ msg: 'Chat pausado. Tente novamente.', type: 'error' });
      return;
    }
    if (deathState?.isDead) {
      setToast({ msg: 'Você está morto e não pode agir nesta mesa.', type: 'error' });
      return;
    }
    if ((!text.trim() && !isSystemInit) || loading) return;

    const currentPlayerId = turnState.order[turnState.currentIndex];
    const formatPlayerInput = (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[PERSONAGEM:')) return trimmed;
      return `[PERSONAGEM: ${campaign.characterName}] ${raw}`;
    };
    if (!isSystemInit && campaignStatus === CampaignStatus.ACTIVE && !turnState.active) {
      setToast({ msg: 'Aguardando o mestre iniciar a rodada.', type: 'error' });
      return;
    }

    if (!isSystemInit && turnState.active) {
      if (!userId || userId !== currentPlayerId) {
        setToast({ msg: 'Aguarde sua vez de jogar.', type: 'error' });
        return;
      }

      const formatted = formatPlayerInput(text);
      const actionMsg: Message = {
        id: crypto.randomUUID(),
        role: Role.USER,
        content: formatted,
        timestamp: Date.now(),
        metadata: {
          type: 'text',
          action: 'turn_action',
          turn_id: turnState.turnId || undefined,
          player_id: userId,
          player_name: campaign.characterName,
          text,
          roll: turnRoll,
        },
      };

      const nextMessages = [...messages, actionMsg];
      setMessages(nextMessages);
      await persistMessage(actionMsg);
      setInput('');
      setTurnRoll(null);
      setLoading(true);
      try {
        const result = await sendChat({
          baseMessages: nextMessages,
          inputText: formatted,
          autoStartTurn: false,
        });
        if (!result?.hasToolCalls && result?.didRespond) {
          await advanceTurnAfterResponse();
        }
      } finally {
        setLoading(false);
      }
      return;
    }
    
    if (!isSystemInit) {
      const formatted = formatPlayerInput(text);
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: Role.USER,
        content: formatted,
        timestamp: Date.now()
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      await persistMessage(userMsg);
      setInput('');
      setLoading(true);
      try {
        await sendChat({ baseMessages: nextMessages, inputText: formatted, autoStartTurn: true });
      } finally {
        setLoading(false);
      }
      return;
    }
    
    setLoading(true);
    try {
      await sendChat({ baseMessages: messages, inputText: text, autoStartTurn: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRollComplete = async (total: number) => {
    if (!diceRequest) return;
    const { req, callId } = diceRequest;
    setDiceRequest(null);
    setLoading(true);

    const attributeValue = characterData?.attributes?.[req.attribute as AttributeName] ?? 0;
    const healthTier = characterData?.health?.tier || 'HEALTHY';
    const difficulty = req.difficulty || 'NORMAL';
    const isProfessionRelevant = !!req.is_profession_relevant;
    const rollResult = calculateRoll({
      attribute: req.attribute,
      attributeValue,
      isProfessionRelevant,
      difficulty,
      healthTier,
      naturalRoll: total,
    });

    setRollDisplay({
      naturalRoll: rollResult.naturalRoll || total,
      outcomeLabel: rollResult.labelPtBr,
    });

    diceChannelRef.current?.send({
      type: 'broadcast',
      event: 'dice_roll',
      payload: {
        roll: rollResult.naturalRoll || total,
        label: rollResult.labelPtBr,
        playerId: userId,
        playerName: campaign.characterName,
      },
    });

    const sysMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.SYSTEM,
      content: `[ROLAGEM] ${rollResult.labelPtBr}.`,
      timestamp: Date.now(),
    };
    const baseMessages = pendingMessagesRef.current || messages;
    const nextMessages = [...baseMessages, sysMsg];
    setMessages(nextMessages);
    await persistMessage(sysMsg);
    pendingMessagesRef.current = null;

    try {
      const result = await sendChat({
        baseMessages: nextMessages,
        toolResponse: { name: 'request_roll', result: rollResult.total ?? total, callId },
        autoStartTurn: !turnState.active,
      });
      if (turnState.active && userId === turnState.order[turnState.currentIndex] && !result?.hasToolCalls && result?.didRespond) {
        await advanceTurnAfterResponse();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTurnRollComplete = (total: number) => {
    setTurnRoll(total);
    setTurnDiceRequest(null);
  };

  const handleRetryLastMessage = async () => {
    if (loading) return;
    const lastUserIndex = [...messages].reverse().findIndex((msg) => msg.role === Role.USER);
    if (lastUserIndex === -1) {
      setIsPaused(false);
      return;
    }
    const targetIndex = messages.length - 1 - lastUserIndex;
    const lastUser = messages[targetIndex];
    const baseMessages = messages.filter((_, index) => index !== targetIndex);
    setIsPaused(false);
    setLoading(true);
    try {
      await sendChat({ baseMessages, inputText: lastUser.content, autoStartTurn: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeath = async (cause: string, future: string) => {
    const deathMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.MODEL,
      content: `## ☠️ VOCÊ MORREU \n\n${cause}\n\n### O Futuro do Mundo:\n${future}`,
      timestamp: Date.now(),
      type: 'death_event'
    };
    setMessages(prev => [...prev, deathMsg]);
    await persistMessage(deathMsg);

    if (userId) {
      const { data } = await supabase
        .from('campaign_players')
        .select('character_data_json')
        .eq('campaign_id', campaign.id)
        .eq('player_id', userId)
        .maybeSingle();

      const base = (data?.character_data_json || {}) as any;
      const inferred = {
        ...(base.inferred || {}),
        health: { tier: 'DEAD', lightDamageCounter: 0 },
      };

      await supabase
        .from('campaign_players')
        .update({
          is_dead: true,
          death_cause: cause,
          death_world_future: future,
          death_at: new Date().toISOString(),
          character_data_json: {
            ...base,
            inferred,
          },
        })
        .eq('campaign_id', campaign.id)
        .eq('player_id', userId);
    }

    const visualStyle = campaign.visualStyle;
    const seed = Math.floor(Math.random() * 9999);
    const prompt = `${visualStyle}. Iconic image of the hero's death, grave, or the aftermath. Melancholic, cinematic.`;
    const users = connectedCount > 0 ? connectedCount : playerCount;
    const imageUrl = `/api/image?prompt=${encodeURIComponent(prompt)}&seed=${seed}&width=768&height=512&users=${users}`;

    const deathImgMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.SYSTEM,
      content: "",
      type: 'image',
      metadata: { imageUrl },
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, deathImgMsg]);
    await persistMessage(deathImgMsg);

    setDeathState({ isDead: true, cause, future });
  };

  const handleCreateNewCharacter = () => {
    if (confirm("Isso apagará o chat atual e iniciará uma nova aventura neste mesmo mundo. Confirmar?")) {
        supabase.from('messages').delete().eq('campaign_id', campaign.id).then(() => {
          window.location.reload();
        });
    }
  };

  const handleArchive = () => {
    supabase.from('campaigns').update({ status: CampaignStatus.ARCHIVED }).eq('id', campaign.id).then(() => {
      setCampaignStatus(CampaignStatus.ARCHIVED);
      onExit();
    });
  };

  const handleUpdateKey = async () => {
      const trimmed = newKeyInput.trim();
      if (!trimmed) return;
      
      try {
        const res = await fetch('/api/validate-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-custom-api-key': trimmed,
          },
        });
        const data = await res.json();
        if (data.ok) {
          localStorage.setItem('user_groq_key', trimmed);
          setApiKey(trimmed);
          setShowKeyUpdateModal(false);
          setNewKeyInput('');
          alert("Chave atualizada! Tente sua ação novamente.");
        } else {
          alert("Chave inválida.");
        }
      } catch (e) {
        alert("Chave inválida.");
      }
  };

  const handleUseItem = async (itemId: string) => {
    if (deathState?.isDead) return;
    if (!characterData) return;
    const item = characterData.inventory.find((entry) => entry.id === itemId);
    if (!item || item.type !== 'consumable' || item.quantity <= 0) return;

    const nextInventory = characterData.inventory.map((entry) => {
      if (entry.id !== itemId) return entry;
      return { ...entry, quantity: Math.max(0, entry.quantity - 1) };
    });
    const nextData = { ...characterData, inventory: nextInventory };
    setCharacterData(nextData);
    await persistCharacter(nextData);
    await handleSendMessage(`Used ${item.name}`);
  };

  const sheet: CharacterSheet = characterData || {
    name: campaign.characterName,
    appearance: campaign.characterAppearance,
    profession: campaign.characterProfession || 'Sem profissao',
    backstory: campaign.characterBackstory,
    attributes: { VIGOR: 0, DESTREZA: 0, MENTE: 0, PRESENÇA: 0 },
    health: { tier: 'HEALTHY', lightDamageCounter: 0 },
    inventory: [],
  };

  const healthStyles = (() => {
    switch (sheet.health.tier) {
      case 'INJURED':
        return {
          bar: 'bg-yellow-500',
          text: 'text-yellow-300',
          ring: 'ring-yellow-500/40',
        };
      case 'CRITICAL':
        return {
          bar: 'bg-red-500',
          text: 'text-red-300',
          ring: 'ring-red-500/40',
        };
      case 'DEAD':
        return {
          bar: 'bg-slate-600',
          text: 'text-slate-400',
          ring: 'ring-slate-600/40',
        };
      default:
        return {
          bar: 'bg-emerald-500',
          text: 'text-emerald-300',
          ring: 'ring-emerald-500/40',
        };
    }
  })();

  // --- Render ---

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-950">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={onExit}>&larr; Voltar</Button>
             <h2 className="font-bold text-slate-100 hidden md:block">{campaign.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
           <span className="text-xs font-mono text-purple-400 border border-purple-900 bg-purple-950/50 px-2 py-1 rounded">
             {campaign.genero}
           </span>
           <span className="text-xs text-slate-300 border border-slate-800 bg-slate-950/50 px-2 py-1 rounded">
             {campaign.tom}
           </span>
           <span className="text-xs text-slate-400 border border-slate-800 bg-slate-950/50 px-2 py-1 rounded">
             {playerCount}/{campaign.maxPlayers || 5}
           </span>
           <Button
             size="sm"
             variant="outline"
             onClick={() => setShowSheet(true)}
           >
             Ficha
           </Button>
           {deathState?.isDead && <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">MORTUS</span>}
           {campaign.ownerId === userId && (
             <Button
               size="sm"
               variant="secondary"
               onClick={() => {
                 const nextStatus = campaignStatus === CampaignStatus.ACTIVE ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;
                 const reason = nextStatus === CampaignStatus.PAUSED ? (prompt('Motivo da pausa (opcional):') || '') : '';
                 const resumeReason = nextStatus === CampaignStatus.ACTIVE ? (prompt('Motivo da retomada (opcional):') || '') : '';
                 supabase.from('campaigns').update({ status: nextStatus }).eq('id', campaign.id).then(() => {
                   setCampaignStatus(nextStatus);
                   setToast({ msg: nextStatus === CampaignStatus.PAUSED ? 'Chat pausado' : 'Chat retomado', type: 'success' });
                   if (nextStatus === CampaignStatus.PAUSED) {
                     postAudit(`[SISTEMA] Chat pausado. ${reason ? `Motivo: ${reason}` : ''}`.trim(), {
                       action: 'pause',
                       reason: reason || null,
                     });
                   } else {
                     postAudit(`[SISTEMA] Chat retomado. ${resumeReason ? `Motivo: ${resumeReason}` : ''}`.trim(), {
                       action: 'resume',
                       reason: resumeReason || null,
                     });
                   }
                 });
               }}
             >
               {campaignStatus === CampaignStatus.ACTIVE ? 'Pausar' : 'Retomar'}
             </Button>
           )}
          {campaign.ownerId === userId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = `/campaigns/${campaign.id}/admin`;
              }}
            >
              Admin
            </Button>
          )}
           <Button
             size="sm"
             variant="outline"
             onClick={() => {
               navigator.clipboard?.writeText(campaign.id);
              setToast({ msg: 'ID copiado!', type: 'success' });
             }}
           >
             Convidar
           </Button>
          </div>
        </div>
      </div>

      {/* Key Update Modal */}
      {showKeyUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-md w-full space-y-4">
                  <div className="text-center">
                      <h3 className="text-xl font-bold text-yellow-500">Limite da API Atingido</h3>
                      <p className="text-slate-400 text-sm mt-2">
                          Sua chave de API atual excedeu o limite em todos os modelos disponíveis. 
                          Aguarde alguns minutos ou insira uma nova chave.
                      </p>
                  </div>
                  <Input 
                      placeholder="Nova API Key" 
                      value={newKeyInput} 
                      onChange={(e) => setNewKeyInput(e.target.value)}
                  />
                  <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => setShowKeyUpdateModal(false)}>Fechar</Button>
                      <Button className="flex-1" onClick={handleUpdateKey} disabled={!newKeyInput}>Atualizar & Continuar</Button>
                  </div>
              </div>
          </div>
      )}

      {showSheet && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">Ficha do Personagem</h3>
              <Button size="sm" variant="secondary" onClick={() => setShowSheet(false)}>Fechar</Button>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-4">
                {campaign.avatarUrl ? (
                  <img src={campaign.avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full border border-slate-700 object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-500">?</div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{sheet.name}</h3>
                  <p className="text-xs text-slate-400">{campaign.genero}</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-300 space-y-2">
                <p><strong>Aparencia:</strong> {sheet.appearance || '—'}</p>
                <p><strong>Profissao:</strong> {sheet.profession || '—'}</p>
                <p><strong>Backstory:</strong> {sheet.backstory || '—'}</p>
                <div className="mt-3 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-3">Estado atual</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
                      <span className="text-xs text-slate-500">Saude</span>
                      <p className={`text-slate-200 ${healthStyles.text}`}>{HEALTH_LABELS[sheet.health.tier]}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={`health-dot-${idx}`}
                            className={`h-2 w-2 rounded-full ${sheet.health.lightDamageCounter > idx ? 'bg-yellow-500' : 'bg-slate-700'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded p-2">
                      <span className="text-xs text-slate-500">Inventario</span>
                      <ul className="mt-1 text-slate-200 text-sm space-y-2">
                        {sheet.inventory.length === 0 && <li>Vazio</li>}
                        {sheet.inventory.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-2">
                            <span>
                              {item.name} {item.quantity > 0 ? `x${item.quantity}` : ''}
                            </span>
                            {item.type === 'consumable' ? (
                              <button
                                type="button"
                                className="text-xs text-purple-200 border border-purple-700/60 px-2 py-1 rounded hover:bg-purple-900/40"
                                onClick={() => handleUseItem(item.id)}
                                disabled={item.quantity <= 0}
                              >
                                Usar
                              </button>
                            ) : (
                              <span className="text-[10px] uppercase text-slate-500">Equipamento</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-2">Atributos</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(['VIGOR', 'DESTREZA', 'MENTE', 'PRESENÇA'] as AttributeName[]).map((attr) => (
                        <div key={attr} className="bg-slate-900/60 border border-slate-800 rounded p-2 text-center">
                          <p className="text-[10px] uppercase text-slate-500">{attr}</p>
                          <p className="text-slate-200 font-semibold">{sheet.attributes[attr]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-auto"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {motd && (
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4 text-sm text-purple-200">
            <p className="font-semibold mb-1">Mensagem do Mestre</p>
            <p>{motd.replace('[SISTEMA] ', '')}</p>
          </div>
        )}
        {isPaused && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 text-sm text-yellow-200">
            <p className="font-semibold mb-1">Conexao interrompida</p>
            <p className="text-yellow-200/80">{pauseNotice}</p>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={handleRetryLastMessage}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
        {campaignStatus === CampaignStatus.WAITING && (
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4 text-sm text-purple-200">
            <p className="font-semibold mb-1">Sala de espera ativa</p>
            <p className="text-purple-200/80">Jogadores: {playerCount}/{campaign.maxPlayers || 5}. O mestre pode iniciar quando quiser.</p>
          </div>
        )}
        {localPlayerStatus === 'pending' && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 text-sm text-yellow-200">
            Você está em modo somente leitura até aprovação do mestre.
          </div>
        )}
        {rollDisplay && (
          <div className={`bg-slate-900/60 border border-slate-800 rounded-xl p-4 ring-1 ${healthStyles.ring}`}>
            <p className="text-xs text-slate-400">Resultado da rolagem</p>
            <div className="mt-1 text-3xl font-bold text-slate-100">{rollDisplay.naturalRoll}</div>
            <div className="text-sm text-purple-200">{rollDisplay.outcomeLabel}</div>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role === Role.SYSTEM && !msg.content && msg.type !== 'image') {
            return null;
          }
          return (
          <div key={msg.id} className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] md:max-w-2xl rounded-2xl p-4 overflow-hidden ${
              msg.role === Role.USER 
                ? 'bg-purple-600 text-white rounded-br-none' 
                : msg.role === Role.SYSTEM && msg.type !== 'image'
                ? 'bg-slate-800 text-slate-400 text-sm border border-slate-700 w-full md:w-auto text-center'
                : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none shadow-lg'
            }`}>
              
              {/* Image Rendering */}
              {msg.type === 'image' && msg.metadata?.imageUrl ? (
                failedImages[msg.id] ? (
                  <div className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300 bg-slate-950/60">
                    <p>Falha no servidor, tente novamente.</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const base = msg.metadata?.imageUrl || '';
                          const sep = base.includes('?') ? '&' : '?';
                          setImageOverrides((prev) => ({
                            ...prev,
                            [msg.id]: `${base}${sep}retry=${Date.now()}`,
                          }));
                          setFailedImages((prev) => ({ ...prev, [msg.id]: false }));
                        }}
                      >
                        Tentar novamente
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = getImageUrl(msg);
                          if (url) window.open(url, '_blank');
                        }}
                      >
                        Abrir imagem
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden border border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(msg)}
                      alt="Scene"
                      className="w-full h-auto object-cover animate-in fade-in duration-700"
                      onError={() => setFailedImages((prev) => ({ ...prev, [msg.id]: true }))}
                    />
                  </div>
                )
              ) : null}
              
              {/* Text Rendering with Markdown */}
              {msg.content && (
                msg.id === typewriterMessageId ? (
                  <TypewriterMarkdown
                    text={msg.content}
                    onTick={() => {
                      requestAnimationFrame(scrollToBottom);
                    }}
                  />
                ) : (
                  <div className="prose prose-invert prose-sm md:prose-base leading-relaxed break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )
              )}
            </div>
          </div>
        );
        })}

          {/* Loading Indicator */}
          {loading && (
          <div className="flex justify-start animate-in fade-in duration-300">
             <div className="bg-slate-900 p-4 rounded-2xl rounded-bl-none flex gap-2 items-center border border-slate-800">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
             </div>
          </div>
        )}

        {/* Death UI Overlay */}
        {deathState?.isDead && !loading && (
          <div className="flex flex-col gap-4 items-center justify-center p-8 bg-slate-900/50 border border-slate-800 rounded-xl mt-8">
            <h3 className="text-2xl font-bold text-red-500">FIM DE JOGO</h3>
            <p className="text-slate-400 text-center">Sua jornada neste corpo encerrou-se.</p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Button onClick={handleCreateNewCharacter} variant="primary">Criar Novo Personagem</Button>
              <Button onClick={handleArchive} variant="secondary">Arquivar Mesa</Button>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      {!deathState?.isDead && (
        <div className="sticky bottom-0 z-20 bg-slate-900 border-t border-slate-800 p-4 shrink-0">
          {turnState.active && (
            <div className="max-w-4xl mx-auto mb-2 text-xs text-slate-400">
              Jogador da vez: {turnState.orderNames[turnState.currentIndex] || 'Jogador'}
            </div>
          )}
          <form 
            className="max-w-4xl mx-auto flex gap-2"
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 resize-none bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              placeholder={
                loading
                  ? "Narrando..."
                  : isPaused
                  ? "Conexao interrompida"
                  : localPlayerStatus === 'pending'
                  ? "Aguardando aprovação..."
                  : localPlayerStatus === 'banned'
                  ? "Acesso bloqueado"
                  : campaignStatus === CampaignStatus.WAITING
                  ? "Aguardando o mestre iniciar..."
                  : campaignStatus === CampaignStatus.PAUSED
                  ? "Chat pausado"
                  : turnState.active && userId !== turnState.order[turnState.currentIndex]
                  ? "Aguardando sua vez..."
                  : "Descreva sua ação..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => resizeInput(e.currentTarget)}
              disabled={isPaused || loading || !!diceRequest || campaignStatus === CampaignStatus.ARCHIVED || campaignStatus === CampaignStatus.WAITING || campaignStatus === CampaignStatus.PAUSED || localPlayerStatus === 'pending' || localPlayerStatus === 'banned' || (turnState.active && userId !== turnState.order[turnState.currentIndex])}
              autoFocus
            />
            <Button type="submit" disabled={isPaused || loading || !input.trim() || !!diceRequest || campaignStatus === CampaignStatus.ARCHIVED || campaignStatus === CampaignStatus.WAITING || campaignStatus === CampaignStatus.PAUSED || localPlayerStatus === 'pending' || localPlayerStatus === 'banned' || (turnState.active && userId !== turnState.order[turnState.currentIndex])}>
              Enviar
            </Button>
          </form>
          {turnState.active && userId === turnState.order[turnState.currentIndex] && turnRoll !== null && (
            <div className="max-w-4xl mx-auto mt-2 text-xs text-purple-300">
              Rolagem registrada: {turnRoll}
            </div>
          )}
          {campaignStatus === CampaignStatus.WAITING && campaign.ownerId === userId && (
            <div className="max-w-4xl mx-auto mt-3 flex justify-end">
              <Button
                variant="secondary"
                isLoading={startingCampaign}
                onClick={async () => {
                  if (startingCampaign) return;
                  setStartingCampaign(true);
                  try {
                    await supabase
                      .from('campaigns')
                      .update({ status: CampaignStatus.ACTIVE })
                      .eq('id', campaign.id);
                    setCampaignStatus(CampaignStatus.ACTIVE);
                  } finally {
                    setStartingCampaign(false);
                  }
                }}
              >
                {startingCampaign ? 'Iniciando...' : 'Iniciar Mesa'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Active Campaign Status Banner if Archived */}
      {campaignStatus === CampaignStatus.ARCHIVED && (
        <div className="p-2 bg-slate-800 text-center text-xs text-yellow-500 font-mono uppercase tracking-wider">
          Campanha Arquivada - Modo Leitura
        </div>
      )}

      {campaignStatus === CampaignStatus.WAITING && (
        <div className="p-2 bg-purple-950 text-center text-xs text-purple-200 font-mono uppercase tracking-wider">
          Sala de espera - aguardando início
        </div>
      )}

      {campaignStatus === CampaignStatus.PAUSED && (
        <div className="p-2 bg-slate-900 text-center text-xs text-slate-300 font-mono uppercase tracking-wider">
          Chat pausado pelo mestre
          {pauseReason && (
            <div className="mt-1 text-[10px] text-slate-500 normal-case font-sans">
              Motivo: {pauseReason}
            </div>
          )}
        </div>
      )}

      {localPlayerStatus === 'pending' && (
        <div className="p-2 bg-yellow-950 text-center text-xs text-yellow-200 font-mono uppercase tracking-wider">
          Aguardando aprovação do mestre
        </div>
      )}

      {localPlayerStatus === 'banned' && (
        <div className="p-2 bg-red-950 text-center text-xs text-red-200 font-mono uppercase tracking-wider">
          Você foi banido desta mesa
        </div>
      )}

      {/* Dice Modal */}
      <DiceRoller 
        isOpen={!!diceRequest || !!turnDiceRequest} 
        request={diceRequest?.req || turnDiceRequest || null}
        onRollComplete={(total) => {
          if (diceRequest) {
            handleRollComplete(total);
          } else {
            handleTurnRollComplete(total);
          }
        }}
      />
    </div>
  );
};

export default function GameSessionRoute() {
  return null;
}