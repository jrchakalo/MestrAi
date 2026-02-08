import React from 'react';
import { Campaign, CampaignStatus } from '../../types';
import { Button } from '../ui/Button';

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
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{camp.title}</h3>
                  <p className="text-slate-400 text-sm line-clamp-3">{camp.description}</p>
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <span className="text-xs text-slate-500">{camp.genero || 'Genero indefinido'}</span>
                  <span className={`text-xs font-semibold ${
                    camp.status === CampaignStatus.ACTIVE ? 'text-green-400' :
                    camp.status === CampaignStatus.WAITING ? 'text-yellow-400' :
                    'text-slate-500'
                  }`}>
                    {camp.status === CampaignStatus.ACTIVE ? 'Ativa' : camp.status === CampaignStatus.WAITING ? 'Aguardando' : 'Arquivada'}
                  </span>
                </div>

                {(onEditCampaign || onDeleteCampaign) && (
                  <div className="absolute top-3 right-3 flex gap-2">
                    {onEditCampaign && (
                      <button
                        type="button"
                        className="text-xs text-purple-300 hover:text-purple-100"
                        onClick={(e) => { e.stopPropagation(); onEditCampaign(camp.id); }}
                      >
                        Editar
                      </button>
                    )}
                    {onDeleteCampaign && (
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:text-red-100"
                        onClick={(e) => { e.stopPropagation(); onDeleteCampaign(camp.id); }}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};