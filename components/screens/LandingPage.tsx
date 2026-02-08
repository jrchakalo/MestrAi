import React from 'react';
import { Button } from '../ui/Button';

interface LandingPageProps {
  onLogin: () => void;
  onHowItWorks: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onHowItWorks }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="MestrAi" className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-purple-500 tracking-tighter">MestrAi</h1>
        </div>
        <div className="flex gap-4">
           <button onClick={onHowItWorks} className="text-slate-400 hover:text-white transition-colors">Como Funciona</button>
           <Button variant="ghost" onClick={onLogin}>Entrar / Criar Conta</Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-3xl space-y-8">
          <h2 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight">
            Sua imaginação, <br />
            <span className="text-purple-500 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-purple-600">
              narrada por IA.
            </span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            O Virtual Tabletop definitivo. Um Narrador de RPG incansável com regras automatizadas para seus sistemas favoritos e imersão visual instantânea.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={onLogin} className="text-lg">Mestra aí!</Button>
            <Button size="lg" variant="outline" onClick={onHowItWorks} className="text-lg">Entenda a Mágica</Button>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center text-slate-600 border-t border-slate-900">
        <p>© 2026 MestrAi. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};