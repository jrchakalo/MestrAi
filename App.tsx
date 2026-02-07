import React, { useState, useEffect } from 'react';
import { Campaign } from './types';
import { LandingPage } from './pages/LandingPage';
import { SetupKey } from './pages/SetupKey';
import { Dashboard } from './pages/Dashboard';
import { CampaignWizard } from './pages/CampaignWizard';
import { GameSession } from './pages/GameSession';
import { HowItWorks } from './pages/HowItWorks';
import { supabase } from './lib/supabaseClient';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Toast } from './components/ui/Toast';

type ViewState = 'LANDING' | 'AUTH' | 'HOW_IT_WORKS' | 'SETUP_KEY' | 'DASHBOARD' | 'WIZARD' | 'GAME';

export default function App() {
  const [view, setView] = useState<ViewState>('LANDING');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  };

  // Load Initial State
  useEffect(() => {
    const key = localStorage.getItem('user_groq_key');
    if (key) setApiKey(key);

    const savedCampaigns = localStorage.getItem('my_campaigns');
    if (savedCampaigns) {
      setCampaigns(JSON.parse(savedCampaigns));
    }

    // Supabase Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && view === 'LANDING') {
          // If already logged in on load
          if (key) setView('DASHBOARD');
          else setView('SETUP_KEY');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Persist Campaigns
  useEffect(() => {
    if (campaigns.length > 0) {
      localStorage.setItem('my_campaigns', JSON.stringify(campaigns));
    }
  }, [campaigns]);

  const handleAuth = async () => {
    // Basic Validation
    if (password.length < 6) {
        showToast("A senha deve ter no mínimo 6 caracteres.", 'error');
        return;
    }

    try {
        if (authMode === 'SIGNUP') {
            if (password !== confirmPassword) {
                showToast("As senhas não coincidem.", 'error');
                return;
            }
            if (!username.trim()) {
                showToast("O nome de usuário é obrigatório.", 'error');
                return;
            }

            const { error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: { data: { username: username } }
            });
            
            if (error) throw error;
            
            // Success Sign Up
            showToast("Cadastro realizado com sucesso! Faça login.", 'success');
            setAuthMode('LOGIN'); // Redirect to Login form
            setPassword('');
            setConfirmPassword('');
            
        } else {
            // LOGIN FLOW
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // Success Login
            showToast("Login realizado com sucesso!", 'success');
            
            // Decide where to go
            if (apiKey) {
                setView('DASHBOARD');
            } else {
                setView('SETUP_KEY');
            }
        }
    } catch (e: any) {
        showToast(e.message || "Erro na autenticação.", 'error');
    }
  };

  const handleKeyComplete = (validKey: string) => {
    setApiKey(validKey);
    setView('DASHBOARD');
  };

  const handleCreateCampaign = async (camp: Campaign) => {
    setCampaigns(prev => [camp, ...prev]);
    setActiveCampaignId(camp.id);
    setView('GAME');
  };

  const handleSelectCampaign = (id: string) => {
    setActiveCampaignId(id);
    setView('GAME');
  };

  const renderAuth = () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-6">
            <h2 className="text-2xl font-bold text-white text-center">{authMode === 'LOGIN' ? 'Entrar na MestrAi' : 'Criar Conta'}</h2>
            
            {authMode === 'SIGNUP' && (
                <Input 
                    label="Nome de Usuário" 
                    type="text" 
                    placeholder="Ex: MestreDosMagos"
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                />
            )}

            <Input 
                label="Email" 
                type="email" 
                placeholder="seu@email.com"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
            />
            
            <div className="relative">
                <Input 
                    label="Senha" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Mínimo 6 caracteres"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[34px] text-slate-400 hover:text-white"
                    tabIndex={-1}
                >
                    {showPassword ? (
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                </button>
            </div>

            {authMode === 'SIGNUP' && (
                <Input 
                    label="Confirmar Senha" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Repita sua senha"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                />
            )}
            
            <Button onClick={handleAuth} className="w-full mt-4">
                {authMode === 'LOGIN' ? 'Entrar' : 'Cadastrar'}
            </Button>
            
            <div className="text-center pt-2">
                <button 
                   className="text-purple-400 text-sm hover:text-purple-300 underline"
                   onClick={() => {
                       setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                   }}
                >
                    {authMode === 'LOGIN' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
                </button>
            </div>
            <div className="text-center">
                <button onClick={() => setView('LANDING')} className="text-slate-600 text-xs hover:text-slate-400">Voltar para Início</button>
            </div>
        </div>
    </div>
  );

  const renderView = () => {
    // Auth Check Interceptor
    if (view === 'AUTH') return renderAuth();
    
    // Main Routing
    switch (view) {
      case 'LANDING':
        // If we have user and key, we probably already redirected in useEffect, 
        // but as a fallback:
        return <LandingPage onLogin={() => setView('AUTH')} onHowItWorks={() => setView('HOW_IT_WORKS')} />;
      
      case 'HOW_IT_WORKS':
        return <HowItWorks onBack={() => setView('LANDING')} />;
        
      case 'SETUP_KEY':
        return <SetupKey onComplete={handleKeyComplete} showToast={showToast} />;
      
      case 'DASHBOARD':
        return (
          <Dashboard 
            campaigns={campaigns} 
            onCreateNew={() => setView('WIZARD')}
            onSelectCampaign={handleSelectCampaign}
            onLogout={() => {
              supabase.auth.signOut();
              setView('LANDING');
              setApiKey(null); // Clear key from state to prevent instant re-login issues if desired
            }}
          />
        );
      
      case 'WIZARD':
        return (
          <CampaignWizard 
            apiKey={apiKey || ''} 
            onSave={handleCreateCampaign} 
            onCancel={() => setView('DASHBOARD')}
          />
        );
      
      case 'GAME':
        const active = campaigns.find(c => c.id === activeCampaignId);
        // Strict check: if no apiKey, don't render game, go to setup
        if (!apiKey) {
             setView('SETUP_KEY');
             return null;
        }
        if (!active) return <div>Erro ao carregar mesa.</div>;
        return (
          <GameSession 
            campaign={active} 
            apiKey={apiKey} 
            onExit={() => setView('DASHBOARD')} 
          />
        );
      
      default:
        return <div>404</div>;
    }
  };

  return (
    <div className="font-sans antialiased text-slate-100 bg-slate-950 min-h-screen selection:bg-purple-500/30 relative">
      {toast && (
        <Toast 
          message={toast.msg} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
      {renderView()}
    </div>
  );
}