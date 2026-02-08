import React from 'react';
import { Campaign, CampaignStatus } from '../types';
import { Button } from '../components/ui/Button';

interface DashboardProps {
  campaigns: Campaign[];
  onCreateNew: () => void;
  onSelectCampaign: (id: string) => void;
  onEditCampaign?: (id: string) => void;
  onDeleteCampaign?: (id: string) => void;
  onJoinById?: (id: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  campaigns,
  onCreateNew,
  onSelectCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onJoinById,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Minhas Mesas</h1>
            <p className="text-slate-400">Gerencie suas campanhas de RPG.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button onClick={onCreateNew} className="w-full sm:w-auto">+ Nova Mesa</Button>
            {onJoinById && (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => {
                const id = prompt('Cole o ID da campanha:');
                if (id) onJoinById(id.trim());
              }}>
                Entrar por ID
              </Button>
            )}
            <Button variant="outline" className="w-full sm:w-auto" onClick={onLogout}>Sair</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-500 text-lg mb-4">Nenhuma campanha encontrada.</p>
              <Button onClick={onCreateNew} variant="secondary">Criar Primeira Aventura</Button>
            </div>
          ) : (
            campaigns.map((camp) => (
              <div 
                key={camp.id} 
                className={`border rounded-xl p-6 transition-colors cursor-pointer flex flex-col h-full relative overflow-hidden ${
                  camp.status === CampaignStatus.ARCHIVED 
                    ? 'bg-slate-900/50 border-slate-800 opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' 
                    : 'bg-slate-900 border-slate-800 hover:border-purple-500'
                }`}
                onClick={() => onSelectCampaign(camp.id)}
              >
                {camp.status === CampaignStatus.ARCHIVED && (
                  <div className="absolute top-0 right-0 bg-slate-800 text-slate-400 text-[10px] px-2 py-1 rounded-bl">
                    ARQUIVADA
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-2 mt-1">
                  <span className="text-xs font-mono uppercase text-purple-400 bg-purple-950 px-2 py-1 rounded">
                    {camp.genero}
                  </span>
                  {(onEditCampaign || onDeleteCampaign) && (
                    <div className="flex gap-1">
                      {onEditCampaign && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditCampaign(camp.id);
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      {onDeleteCampaign && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCampaign(camp.id);
                          }}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  )}
                  {camp.status === CampaignStatus.ACTIVE && (
                     <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  )}
                </div>
                
                <div className="flex gap-4 items-start mb-4">
                  {camp.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={camp.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full border border-slate-600 object-cover shrink-0" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{camp.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{camp.characterName}</p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm mb-4 line-clamp-3 flex-1">{camp.worldHistory || camp.description}</p>
                
                <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
                  <span className="truncate max-w-[60%]">{camp.tom}</span>
                  <span className="text-purple-400 group-hover:translate-x-1 transition-transform">
                    {camp.status === CampaignStatus.ARCHIVED ? 'Ler Histórico' : 'Jogar'} &rarr;
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default function DashboardRoute() {
  return null;
}
