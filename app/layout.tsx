import './globals.css';
import React from 'react';

export const metadata = {
  title: 'MestrAi - Virtual Tabletop',
  description: 'Virtual Tabletop com IA como mestre de RPG.',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased text-slate-100 bg-slate-950 min-h-screen selection:bg-purple-500/30">
        {children}
      </body>
    </html>
  );
}
