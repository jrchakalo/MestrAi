import React from 'react';
import { Button } from '../components/ui/Button';

interface HowItWorksProps {
  onBack: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="p-6">
        <Button variant="ghost" onClick={onBack}>&larr; Voltar</Button>
      </header>
      
      <main className="flex-1 max-w-4xl mx-auto p-4 md:p-8 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">Como a MestrAi Funciona?</h1>
          <p className="text-xl text-slate-400">RPG de mesa infinito, onde a tecnologia cuida das regras e você foca na diversão.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-2xl font-bold text-indigo-400 mb-4">1. O Narrador (Cérebro)</h3>
              <p className="text-slate-300 leading-relaxed">
                Usamos uma Inteligência Artificial avançada (Groq) treinada para agir como um Mestre de RPG. Ela lê suas ações, improvisa a história na hora e nunca se cansa, lembrando de tudo o que aconteceu na sua aventura.
              </p>
           </div>
           
           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-2xl font-bold text-indigo-400 mb-4">2. O Artista (Visual)</h3>
              <p className="text-slate-300 leading-relaxed">
                Imagine um livro que se desenha sozinho. Enquanto você joga, o sistema cria ilustrações de cenários, inimigos e momentos épicos em tempo real, combinando com o estilo da sua história.
              </p>
           </div>

           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-2xl font-bold text-indigo-400 mb-4">3. O Juiz (Regras)</h3>
              <p className="text-slate-300 leading-relaxed">
                Não se preocupe em decorar livros de regras. Quando você tenta algo arriscado (como pular um muro ou mentir para um guarda), o sistema pausa, pede para você rolar o dado e calcula o resultado automaticamente.
              </p>
           </div>

           <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <h3 className="text-2xl font-bold text-indigo-400 mb-4">4. Sua Chave, Seu Controle</h3>
              <p className="text-slate-300 leading-relaxed">
                Para garantir privacidade e controle no uso da inteligência, você conecta sua própria chave da Groq (é grátis e fácil de gerar). Nós não lemos suas conversas e você joga o quanto quiser sem pagar mensalidade para a plataforma.
              </p>
           </div>
        </div>

        <div className="bg-indigo-900/20 p-8 rounded-xl text-center space-y-6">
           <h2 className="text-2xl font-bold text-white">Pronto para jogar?</h2>
           <Button size="lg" onClick={onBack}>Criar Minha Aventura</Button>
        </div>
      </main>
    </div>
  );
};

export default function HowItWorksPage() {
  return null;
}