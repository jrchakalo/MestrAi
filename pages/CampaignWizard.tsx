import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingDots } from '../components/ui/LoadingDots';
import { Campaign, CampaignStatus } from '../types';
import { RPG_SYSTEMS } from '../constants';

interface CampaignWizardProps {
  onSave: (campaign: Campaign) => Promise<void>;
  onCancel: () => void;
  apiKey: string;
}

type Step = 'WORLD' | 'CHARACTER';

export const CampaignWizard: React.FC<CampaignWizardProps> = ({ onSave, onCancel, apiKey }) => {
  const [step, setStep] = useState<Step>('WORLD');
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    // World
    title: '',
    genre: '',
    systemName: 'Narrativo',
    worldHistory: '',
    visualStyle: '',
    // Character
    characterName: '',
    characterAppearance: '',
    characterBackstory: '',
    characterProfession: '',
    avatarUrl: ''
  });

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

  const handleGenTitle = async () => {
    setGeneratingField('title');
    try {
        const text = await callSuggest('suggestTitle', { system: formData.systemName });
        setFormData(prev => ({ ...prev, title: text.replace(/["*]/g, '').trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenGenre = async () => {
    setGeneratingField('genre');
    try {
        // Pass the title to generate a relevant genre
        const text = await callSuggest('suggestGenre', { title: formData.title });
        setFormData(prev => ({ ...prev, genre: text.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenWorld = async () => {
    if (!formData.genre) { alert("Preencha ou gere o Gênero primeiro."); return; }
    setGeneratingField('world');
    try {
      const text = await callSuggest('suggestWorldHistory', { genre: formData.genre, system: formData.systemName });
      setFormData(prev => ({ ...prev, worldHistory: text.trim() }));
    } catch (e) { console.error(e); } 
    setGeneratingField(null);
  };

  const handleGenStyle = async () => {
    if (!formData.worldHistory || !formData.genre) { alert("Preencha Gênero e História primeiro."); return; }
    setGeneratingField('style');
    try {
      const style = await callSuggest('suggestStyle', { worldHistory: formData.worldHistory, system: formData.systemName, genre: formData.genre });
      setFormData(prev => ({ ...prev, visualStyle: style.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenName = async () => {
    if (!formData.genre) { alert("Preencha o Gênero no passo anterior."); return; }
    setGeneratingField('name');
    try {
      const name = await callSuggest('suggestCharacterName', { genre: formData.genre, system: formData.systemName });
      setFormData(prev => ({ ...prev, characterName: name.replace(/["*]/g, '').trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenAppearance = async () => {
    if (!formData.characterName) { alert("Preencha o Nome primeiro."); return; }
    setGeneratingField('appearance');
    try {
      const text = await callSuggest('suggestCharacterAppearance', { genre: formData.genre, name: formData.characterName });
      setFormData(prev => ({ ...prev, characterAppearance: text.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenBackstory = async () => {
    if (!formData.characterName || !formData.worldHistory) { alert("Preencha Nome e História do Mundo."); return; }
    if (!formData.characterAppearance && !formData.characterProfession) {
      alert("Preencha Aparência ou Profissão primeiro.");
      return;
    }
    setGeneratingField('backstory');
    try {
      const text = await callSuggest('suggestCharacterBackstory', {
        name: formData.characterName,
        appearance: formData.characterAppearance,
        profession: formData.characterProfession,
        worldHistory: formData.worldHistory,
      });
      setFormData(prev => ({ ...prev, characterBackstory: text.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenProfession = async () => {
    if (!formData.characterAppearance && !formData.characterBackstory) {
      alert("Preencha Aparência ou Background primeiro.");
      return;
    }
    setGeneratingField('profession');
    try {
      const text = await callSuggest('suggestCharacterProfession', {
        appearance: formData.characterAppearance,
        backstory: formData.characterBackstory,
      });
      setFormData(prev => ({ ...prev, characterProfession: text.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const generateAvatar = async () => {
    if (!formData.characterAppearance || !formData.visualStyle) {
      alert("Preencha a aparência e certifique-se que o Estilo Visual foi gerado (passo anterior)!");
      return;
    }
    setGeneratingAvatar(true);
    try {
      const seed = Math.floor(Math.random() * 10000);
      const promptText = `${formData.visualStyle}, character portrait, ${formData.characterAppearance}, centered, high quality, variation ${seed}`;
      const url = `/api/image?prompt=${encodeURIComponent(promptText)}&seed=${seed}&width=512&height=512&users=0`;
      
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setFormData(prev => ({ ...prev, avatarUrl: url }));
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

  const handleSubmit = async () => {
    if (!formData.characterName || !formData.characterBackstory) return;
    if (submitting) return;
    setSubmitting(true);

    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      ...formData,
      description: formData.worldHistory.slice(0, 100) + '...', 
      status: CampaignStatus.ACTIVE,
      createdAt: Date.now()
    };
    try {
      await onSave(newCampaign);
    } finally {
      setSubmitting(false);
    }
  };

  const MagicBtn = ({ onClick, loading }: { onClick: () => void, loading: boolean }) => (
    <button 
      type="button" 
      onClick={onClick} 
      disabled={loading}
      className="absolute right-2 top-8 text-xs bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/50 px-2 py-1 rounded transition-colors"
    >
      {loading ? <LoadingDots className="text-indigo-200" /> : "✨ IA"}
    </button>
  );

  const renderWorldStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-xl font-bold text-indigo-400">Passo 1: O Mundo</h3>
      
      <div className="relative">
        <Input 
          label="Nome da Campanha" 
          required 
          value={formData.title}
          onChange={e => setFormData({...formData, title: e.target.value})}
          placeholder="Ex: As Crônicas de Eldoria"
        />
        <MagicBtn onClick={handleGenTitle} loading={generatingField === 'title'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
             <Input 
            label="Gênero(s)" 
            required
            value={formData.genre}
            onChange={e => setFormData({...formData, genre: e.target.value})}
            placeholder="Ex: Dark Fantasy, Cyberpunk"
            />
            <MagicBtn onClick={handleGenGenre} loading={generatingField === 'genre'} />
        </div>
        
        <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Sistema</label>
            <select 
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2.5 text-slate-100 focus:ring-2 focus:ring-indigo-500"
            value={formData.systemName}
            onChange={e => setFormData({...formData, systemName: e.target.value})}
            >
              {Object.keys(RPG_SYSTEMS).map(sys => (
                <option key={sys} value={sys}>{sys}</option>
              ))}
            </select>
        </div>
      </div>

      <div className="relative">
        <label className="text-sm font-medium text-slate-300 mb-1 block">História do Mundo & Contexto</label>
        <textarea 
          className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-600"
          value={formData.worldHistory}
          onChange={e => setFormData({...formData, worldHistory: e.target.value})}
          placeholder="A IA irá gerar baseada no Gênero e Sistema escolhidos..."
        />
        <MagicBtn onClick={handleGenWorld} loading={generatingField === 'world'} />
      </div>

      <div className="relative">
        <label className="text-sm font-medium text-slate-300 mb-1 block">Estilo Visual (Prompt de Imagem)</label>
        <textarea 
          className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-slate-400 h-20 text-sm focus:outline-none"
          value={formData.visualStyle}
          onChange={e => setFormData({...formData, visualStyle: e.target.value})}
          placeholder="Estilo usado para gerar imagens (Prompt)"
        />
        <MagicBtn onClick={handleGenStyle} loading={generatingField === 'style'} />
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          disabled={!formData.title || !formData.worldHistory || !formData.genre} 
          onClick={() => setStep('CHARACTER')}
        >
          Próximo: Criar Personagem &rarr;
        </Button>
      </div>
    </div>
  );

  const renderCharacterStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-xl font-bold text-indigo-400">Passo 2: O Herói</h3>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="relative">
            <Input 
                label="Nome do Personagem" 
                required
                value={formData.characterName}
                onChange={e => setFormData({...formData, characterName: e.target.value})}
            />
            <MagicBtn onClick={handleGenName} loading={generatingField === 'name'} />
          </div>
          
          <div className="relative">
            <label className="text-sm font-medium text-slate-300 mb-1 block">Aparência Física</label>
            <textarea 
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-24 focus:ring-2 focus:ring-indigo-500"
              value={formData.characterAppearance}
              onChange={e => setFormData({...formData, characterAppearance: e.target.value})}
              placeholder="Cabelos prateados, cicatriz no olho esquerdo, veste armadura de couro..."
            />
             <MagicBtn onClick={handleGenAppearance} loading={generatingField === 'appearance'} />
          </div>
          <div className="relative">
            <Input
              label="Profissão/Ocupação (opcional)"
              value={formData.characterProfession}
              onChange={e => setFormData({ ...formData, characterProfession: e.target.value })}
              placeholder="Ex: Caçador, Investigador, Médico..."
            />
            <MagicBtn onClick={handleGenProfession} loading={generatingField === 'profession'} />
          </div>
        </div>

        {/* Avatar Area */}
        <div className="w-full md:w-48 flex flex-col items-center gap-2">
           <div className="w-40 h-40 bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden relative">
             {formData.avatarUrl ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
             ) : (
               <span className="text-4xl text-slate-600">?</span>
             )}
             {generatingAvatar && (
               <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col">
                 <span className="animate-spin text-2xl">⏳</span>
               </div>
             )}
           </div>
           <Button 
             type="button" 
             variant="secondary" 
             size="sm" 
             onClick={generateAvatar}
             disabled={generatingAvatar || !formData.characterAppearance}
             className="w-full text-xs"
           >
             {formData.avatarUrl ? "Regerar Avatar" : "Gerar Avatar"}
           </Button>
           {generatingAvatar && <span className="text-[10px] text-yellow-500 text-center leading-tight">Aguarde, pode demorar alguns segundos...</span>}
        </div>
      </div>

      <div className="relative">
        <label className="text-sm font-medium text-slate-300 mb-1 block">História do Personagem (Background)</label>
        <textarea 
          className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={formData.characterBackstory}
          onChange={e => setFormData({...formData, characterBackstory: e.target.value})}
          placeholder="Nasceu nas ruas de..."
        />
        <MagicBtn onClick={handleGenBackstory} loading={generatingField === 'backstory'} />
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="ghost" onClick={() => setStep('WORLD')}>&larr; Voltar</Button>
        <Button 
          onClick={handleSubmit} 
          isLoading={submitting}
          disabled={submitting || !formData.characterName || !formData.characterBackstory} 
          className="flex-1"
        >
          {submitting ? 'Iniciando...' : 'Iniciar Aventura Agora'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-2xl">
        <div className="mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-white">Criar Nova Mesa</h2>
          <div className="flex gap-2">
            <span className={`w-3 h-3 rounded-full ${step === 'WORLD' ? 'bg-indigo-500' : 'bg-slate-700'}`} />
            <span className={`w-3 h-3 rounded-full ${step === 'CHARACTER' ? 'bg-indigo-500' : 'bg-slate-700'}`} />
          </div>
        </div>

        {step === 'WORLD' ? renderWorldStep() : renderCharacterStep()}
        
        <div className="mt-4 text-center">
             <button onClick={onCancel} className="text-slate-500 text-sm hover:text-white underline">Cancelar Criação</button>
        </div>
      </div>
    </div>
  );
};

export default function CampaignWizardRoute() {
  return null;
}