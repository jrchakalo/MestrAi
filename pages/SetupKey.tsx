import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface SetupKeyProps {
  onComplete: (validKey: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

const OPENROUTER_KEY_REGEX = /^sk-or-v1-[a-zA-Z0-9_-]+$/;

export const SetupKey: React.FC<SetupKeyProps> = ({ onComplete, showToast }) => {
  const [key, setKey] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user_openrouter_key');
    if (stored) setKey(stored);
  }, []);

  const handleSave = async () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
        showToast("Por favor, insira uma chave.", 'error');
        return;
    }
    if (!OPENROUTER_KEY_REGEX.test(trimmedKey)) {
      showToast("Formato inválido. Use uma chave OpenRouter começando com sk-or-v1-.", 'error');
      return;
    }
    
    setValidating(true);
    let isValid = false;
    let errorMessage = '';
    try {
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-custom-api-key': trimmedKey,
        },
      });
      const data = await res.json();
      isValid = !!data.ok;
      errorMessage = data.error || '';
    } catch (e) {
      isValid = false;
    }
    setValidating(false);

    if (isValid) {
        localStorage.setItem('user_openrouter_key', trimmedKey);
        showToast("Chave validada com sucesso!", 'success');
        onComplete(trimmedKey);
    } else {
      showToast(errorMessage || "Chave inválida ou erro de conexão. Verifique no console do OpenRouter.", 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-slate-900 p-8 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-3xl font-bold text-white text-center">Configurar Chave</h2>
          <p className="mt-2 text-center text-slate-400">
            A MestraAI utiliza OpenRouter e pode ser jogada no tier FREE. Para continuar, você precisa da sua própria chave de API.
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-sm text-yellow-200">
          <p className="font-bold mb-1">⚠️ Aviso Importante</p>
          <p>Nós NÃO armazenamos sua chave em nossos servidores. Ela é salva <strong>localmente no seu navegador</strong>. Se você limpar o cache ou trocar de dispositivo/navegador, será necessário inseri-la novamente.</p>
          <p className="mt-2">O OpenRouter mostra a chave apenas uma vez. Copie e guarde antes de fechar a tela.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800 p-4 rounded text-sm text-slate-300">
            <ol className="list-decimal list-inside space-y-2">
              <li>Crie uma conta em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-purple-400 underline">OpenRouter.ai</a>.</li>
              <li>Entre na seção "Keys" e gere uma nova chave.</li>
              <li>Você pode jogar de graça com modelos FREE (adicione créditos apenas se quiser modelos pagos).</li>
              <li>Cole a chave abaixo para validar e continuar.</li>
            </ol>
          </div>

          <Input 
            label="Sua API Key" 
            placeholder="sk-or-v1-..." 
            value={key} 
            onChange={(e) => setKey(e.target.value)}
            type="password"
          />

          <Button onClick={handleSave} className="w-full" size="lg" isLoading={validating}>
            {validating ? "Validando..." : "Salvar e Entrar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function SetupKeyRoute() {
  return null;
}