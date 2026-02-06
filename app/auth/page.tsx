'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Toast } from '../../components/ui/Toast';
import { supabase } from '../../lib/supabase/client';

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.push('/setup-key');
      }
    });
  }, [router]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
  };

  const handleAuth = async () => {
    if (password.length < 6) {
      showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    try {
      setLoading(true);

      if (authMode === 'SIGNUP') {
        if (password !== confirmPassword) {
          showToast('As senhas não coincidem.', 'error');
          return;
        }
        if (!username.trim()) {
          showToast('O nome de usuário é obrigatório.', 'error');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (error) throw error;

        if (data.user?.id) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: username.trim(),
          });
        }

        showToast('Cadastro realizado com sucesso! Faça login.', 'success');
        setAuthMode('LOGIN');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showToast('Login realizado com sucesso!', 'success');
      router.push('/setup-key');
    } catch (e: any) {
      showToast(e.message || 'Erro na autenticação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="w-full max-w-md bg-slate-900 p-8 rounded-xl border border-slate-800 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">
          {authMode === 'LOGIN' ? 'Entrar na MestrAi' : 'Criar Conta'}
        </h2>

        {authMode === 'SIGNUP' && (
          <Input
            label="Nome de Usuário"
            type="text"
            placeholder="Ex: MestreDosMagos"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <Input
          label="Email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <Input
            label="Senha"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            type={showPassword ? 'text' : 'password'}
            placeholder="Repita sua senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}

        <Button onClick={handleAuth} className="w-full mt-4" isLoading={loading}>
          {authMode === 'LOGIN' ? 'Entrar' : 'Cadastrar'}
        </Button>

        <div className="text-center pt-2">
          <button
            className="text-indigo-400 text-sm hover:text-indigo-300 underline"
            onClick={() => setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
          >
            {authMode === 'LOGIN' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </div>
        <div className="text-center">
          <button onClick={() => router.push('/')} className="text-slate-600 text-xs hover:text-slate-400">Voltar para Início</button>
        </div>
      </div>
    </div>
  );
}
