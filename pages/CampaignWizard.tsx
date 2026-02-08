import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingDots } from '../components/ui/LoadingDots';
import { Campaign, CampaignStatus } from '../types';

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
  const [generoOption, setGeneroOption] = useState('');
  const [generoOther, setGeneroOther] = useState('');
  const [tomOption, setTomOption] = useState('');
  const [tomOther, setTomOther] = useState('');
  const [magiaOption, setMagiaOption] = useState('');
  const [magiaOther, setMagiaOther] = useState('');
  const [techOption, setTechOption] = useState('');
  const [techOther, setTechOther] = useState('');
  
  const [formData, setFormData] = useState({
    // World
    title: '',
    genero: '',
    tom: '',
    magia: '',
    tech: '',
    worldHistory: '',
    visualStyle: '',
    // Character
    characterName: '',
    characterAppearance: '',
    characterBackstory: '',
    characterProfession: '',
    avatarUrl: ''
  });

  const GENERO_OPTIONS = [
    'Fantasia Epica',
    'Cyberpunk',
    'Terror Sobrenatural',
    'Ficcao Cientifica',
    'Pos-Apocaliptico',
    'Investigacao Noir',
    'Velho Oeste',
    'Super-Herois',
    'Isekai',
    'Steampunk',
    'Outro'
  ];

  const TOM_OPTIONS = [
    'Heroico (Facil)',
    'Aventura Padrao (Normal)',
    'Sombrio (Dificil)',
    'Terror Mortal (Muito Dificil)',
    'Comedia',
    'Outro'
  ];

  const MAGIA_OPTIONS = [
    'Mundano (Sem Magia)',
    'Baixa Fantasia (Rara/Perigosa)',
    'Alta Fantasia (Comum/Poderosa)',
    'Divina/Mitica',
    'Sombria/Corrupta',
    'Outro'
  ];

  const TECH_OPTIONS = [
    'Primitivo/Idade da Pedra',
    'Medieval/Arcaico',
    'Industrial/Steampunk',
    'Moderno (Sec. XXI)',
    'Avancado/Sci-Fi',
    'Retro-Futurista',
    'Outro'
  ];

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
        const text = await callSuggest('suggestTitle', {
          genero: formData.genero,
          tom: formData.tom,
          magia: formData.magia,
          tech: formData.tech,
        });
        setFormData(prev => ({ ...prev, title: text.replace(/["*]/g, '').trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenWorld = async () => {
    if (!formData.genero || !formData.tom || !formData.magia || !formData.tech) {
      alert('Preencha Gênero, Tom, Magia e Tecnologia primeiro.');
      return;
    }
    setGeneratingField('world');
    try {
      const text = await callSuggest('suggestWorldHistory', {
        genero: formData.genero,
        tom: formData.tom,
        magia: formData.magia,
        tech: formData.tech,
        title: formData.title,
      });
      setFormData(prev => ({ ...prev, worldHistory: text.trim() }));
    } catch (e) { console.error(e); } 
    setGeneratingField(null);
  };

  const handleGenStyle = async () => {
    if (!formData.worldHistory || !formData.genero || !formData.tom || !formData.magia || !formData.tech) {
      alert('Preencha Gênero, Tom, Magia, Tecnologia e História primeiro.');
      return;
    }
    setGeneratingField('style');
    try {
      const style = await callSuggest('suggestStyle', {
        worldHistory: formData.worldHistory,
        genero: formData.genero,
        tom: formData.tom,
        magia: formData.magia,
        tech: formData.tech,
      });
      setFormData(prev => ({ ...prev, visualStyle: style.trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenName = async () => {
    if (!formData.genero) { alert('Preencha o Genero no passo anterior.'); return; }
    setGeneratingField('name');
    try {
      const name = await callSuggest('suggestCharacterName', { genero: formData.genero });
      setFormData(prev => ({ ...prev, characterName: name.replace(/["*]/g, '').trim() }));
    } catch (e) { console.error(e); }
    setGeneratingField(null);
  };

  const handleGenAppearance = async () => {
    if (!formData.characterName) { alert("Preencha o Nome primeiro."); return; }
    setGeneratingField('appearance');
    try {
      const text = await callSuggest('suggestCharacterAppearance', { genero: formData.genero, name: formData.characterName });
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
      className="absolute right-2 top-8 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/50 px-2 py-1 rounded transition-colors"
    >
      {loading ? <LoadingDots className="text-purple-200" /> : "✨ IA"}
    </button>
  );

  const renderWorldStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-xl font-bold text-purple-400">Passo 1: O Mundo</h3>
      
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
        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Genero Principal</label>
          <select
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2.5 text-slate-100 focus:ring-2 focus:ring-purple-500"
            value={generoOption}
            onChange={e => {
              const value = e.target.value;
              setGeneroOption(value);
              if (value !== 'Outro') {
                setGeneroOther('');
                setFormData(prev => ({ ...prev, genero: value }));
              } else {
                setFormData(prev => ({ ...prev, genero: generoOther.trim() }));
              }
            }}
          >
            <option value="">Selecione</option>
            {GENERO_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {generoOption === 'Outro' && (
            <div className="mt-2">
              <Input
                label="Outro Genero"
                required
                value={generoOther}
                onChange={e => {
                  setGeneroOther(e.target.value);
                  setFormData(prev => ({ ...prev, genero: e.target.value }));
                }}
                placeholder="Digite o genero"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Tom e Letalidade</label>
          <select
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2.5 text-slate-100 focus:ring-2 focus:ring-purple-500"
            value={tomOption}
            onChange={e => {
              const value = e.target.value;
              setTomOption(value);
              if (value !== 'Outro') {
                setTomOther('');
                setFormData(prev => ({ ...prev, tom: value }));
              } else {
                setFormData(prev => ({ ...prev, tom: tomOther.trim() }));
              }
            }}
          >
            <option value="">Selecione</option>
            {TOM_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {tomOption === 'Outro' && (
            <div className="mt-2">
              <Input
                label="Outro Tom"
                required
                value={tomOther}
                onChange={e => {
                  setTomOther(e.target.value);
                  setFormData(prev => ({ ...prev, tom: e.target.value }));
                }}
                placeholder="Descreva o tom"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Nivel de Magia</label>
          <select
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2.5 text-slate-100 focus:ring-2 focus:ring-purple-500"
            value={magiaOption}
            onChange={e => {
              const value = e.target.value;
              setMagiaOption(value);
              if (value !== 'Outro') {
                setMagiaOther('');
                setFormData(prev => ({ ...prev, magia: value }));
              } else {
                setFormData(prev => ({ ...prev, magia: magiaOther.trim() }));
              }
            }}
          >
            <option value="">Selecione</option>
            {MAGIA_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {magiaOption === 'Outro' && (
            <div className="mt-2">
              <Input
                label="Outro Nivel de Magia"
                required
                value={magiaOther}
                onChange={e => {
                  setMagiaOther(e.target.value);
                  setFormData(prev => ({ ...prev, magia: e.target.value }));
                }}
                placeholder="Descreva o nivel de magia"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-1 block">Nivel de Tecnologia</label>
          <select
            className="w-full bg-slate-950 border border-slate-700 rounded-md p-2.5 text-slate-100 focus:ring-2 focus:ring-purple-500"
            value={techOption}
            onChange={e => {
              const value = e.target.value;
              setTechOption(value);
              if (value !== 'Outro') {
                setTechOther('');
                setFormData(prev => ({ ...prev, tech: value }));
              } else {
                setFormData(prev => ({ ...prev, tech: techOther.trim() }));
              }
            }}
          >
            <option value="">Selecione</option>
            {TECH_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {techOption === 'Outro' && (
            <div className="mt-2">
              <Input
                label="Outro Nivel de Tecnologia"
                required
                value={techOther}
                onChange={e => {
                  setTechOther(e.target.value);
                  setFormData(prev => ({ ...prev, tech: e.target.value }));
                }}
                placeholder="Descreva o nivel de tecnologia"
              />
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <label className="text-sm font-medium text-slate-300 mb-1 block">História do Mundo & Contexto</label>
        <textarea 
          className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-32 focus:ring-2 focus:ring-purple-500 focus:outline-none placeholder:text-slate-600"
          value={formData.worldHistory}
          onChange={e => setFormData({...formData, worldHistory: e.target.value})}
          placeholder="A IA ira gerar baseada no genero, tom, magia e tecnologia escolhidos..."
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
          disabled={!formData.title || !formData.worldHistory || !formData.genero || !formData.tom || !formData.magia || !formData.tech} 
          onClick={() => setStep('CHARACTER')}
        >
          Próximo: Criar Personagem &rarr;
        </Button>
      </div>
    </div>
  );

  const renderCharacterStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <h3 className="text-xl font-bold text-purple-400">Passo 2: O Herói</h3>

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
              className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-24 focus:ring-2 focus:ring-purple-500"
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
          className="w-full bg-slate-950 border border-slate-700 rounded-md p-3 text-slate-100 h-32 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          value={formData.characterBackstory}
          onChange={e => setFormData({...formData, characterBackstory: e.target.value})}
          placeholder="Nasceu nas ruas de..."
        />
        <MagicBtn onClick={handleGenBackstory} loading={generatingField === 'backstory'} />
      </div>

      <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
        <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setStep('WORLD')}>&larr; Voltar</Button>
        <Button 
          onClick={handleSubmit} 
          isLoading={submitting}
          disabled={submitting || !formData.characterName || !formData.characterBackstory} 
          className="w-full sm:flex-1"
        >
          {submitting ? 'Iniciando...' : (
            <>
              <span className="sm:hidden">Iniciar Aventura</span>
              <span className="hidden sm:inline">Iniciar Aventura Agora</span>
            </>
          )}
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
            <span className={`w-3 h-3 rounded-full ${step === 'WORLD' ? 'bg-purple-500' : 'bg-slate-700'}`} />
            <span className={`w-3 h-3 rounded-full ${step === 'CHARACTER' ? 'bg-purple-500' : 'bg-slate-700'}`} />
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