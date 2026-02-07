import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface SetupKeyProps {
  onComplete: (validKey: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const SetupKey: React.FC<SetupKeyProps> = ({ onComplete, showToast }) => {
  const [key, setKey] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user_groq_key');
    if (stored) setKey(stored);
  }, []);

  const handleSave = async () => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
        showToast("Por favor, insira uma chave.", 'error');
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
        localStorage.setItem('user_groq_key', trimmedKey);
        showToast("Chave validada com sucesso!", 'success');
        onComplete(trimmedKey);
    } else {
      showToast(errorMessage || "Chave inválida ou erro de conexão. Verifique no console da Groq.", 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-slate-900 p-8 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-3xl font-bold text-white text-center">Configurar Chave</h2>
          <p className="mt-2 text-center text-slate-400">
            A MestraAI utiliza a tecnologia Groq. Para continuar, você precisa da sua própria chave de API.
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded text-sm text-yellow-200">
          <p className="font-bold mb-1">⚠️ Aviso Importante</p>
          <p>Nós NÃO armazenamos sua chave em nossos servidores. Ela é salva <strong>localmente no seu navegador</strong>. Se você limpar o cache ou trocar de dispositivo/navegador, será necessário inseri-la novamente.</p>
          <p className="mt-2">A Groq mostra a chave apenas uma vez. Copie e guarde antes de fechar a tela.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800 p-4 rounded text-sm text-slate-300">
            <ol className="list-decimal list-inside space-y-2">
              <li>Acesse <a href="https://console.groq.com/keys" target="_blank" className="text-purple-400 underline">Groq Console</a>.</li>
              <li>Clique em "Create API Key" para gerar uma chave.</li>
              <li>Copie a chave gerada (ela aparece apenas uma vez) e cole abaixo.</li>
            </ol>
          </div>

          <Input 
            label="Sua API Key" 
            placeholder="gsk_..." 
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