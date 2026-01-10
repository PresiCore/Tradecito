
import React from 'react';
import { AISignal, SignalType } from '../types';

interface AIPanelProps {
  signal: AISignal | null;
  loading: boolean;
  onAnalyze: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ signal, loading, onAnalyze }) => {
  
  const getSignalColor = (s: SignalType) => {
    switch (s) {
      case SignalType.BUY: return 'text-trade-green border-trade-green';
      case SignalType.SELL: return 'text-trade-red border-trade-red';
      case SignalType.HOLD: return 'text-blue-400 border-blue-600';
      default: return 'text-trade-muted border-trade-muted';
    }
  };

  const getLeverageColor = (lev: number) => {
    if (lev <= 5) return 'text-green-400 border-green-800 bg-green-900/20';
    if (lev <= 10) return 'text-yellow-400 border-yellow-800 bg-yellow-900/20';
    return 'text-purple-400 border-purple-800 bg-purple-900/20';
  };

  return (
    <div className="h-full flex flex-col bg-trade-panel border border-trade-border rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-bold flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-purple-500' : 'bg-blue-500'} animate-pulse`}></span>
          NÚCLEO ANTIGRAVEDAD
        </h2>
        <button 
          onClick={onAnalyze}
          disabled={loading}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${loading ? 'bg-gray-700 text-gray-400' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
        >
          {loading ? 'CALCULANDO...' : 'FORZAR CICLO'}
        </button>
      </div>

      {signal ? (
        <div className="flex-1 flex flex-col gap-3 animate-in fade-in duration-500">
          
          {/* Signal Header */}
          <div className={`border-l-4 pl-4 py-2 ${getSignalColor(signal.action)} bg-trade-bg rounded-r relative`}>
             {(signal.action === SignalType.BUY || signal.action === SignalType.SELL) && (
               <div className={`absolute right-2 top-2 px-2 py-0.5 rounded border text-[10px] font-bold ${getLeverageColor(signal.leverage || 1)}`}>
                  {signal.leverage}x LEV
               </div>
             )}
            <div className="text-[10px] text-trade-muted uppercase tracking-wider">Acción Óptima (PPO)</div>
            <div className="text-3xl font-black tracking-tighter">{signal.action}</div>
          </div>

          {/* Quant Metrics Grid */}
          {signal.quantMetrics && (
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-trade-bg p-2 rounded border border-trade-border">
                    <div className="text-[9px] text-trade-muted uppercase">HURST (Régimen)</div>
                    <div className={`text-xs font-mono font-bold ${signal.quantMetrics.hurst > 0.5 ? 'text-purple-400' : 'text-blue-400'}`}>
                        {signal.quantMetrics.hurst.toFixed(3)} {signal.quantMetrics.hurst > 0.5 ? 'TEND' : 'RANGO'}
                    </div>
                 </div>
                 <div className="bg-trade-bg p-2 rounded border border-trade-border">
                    <div className="text-[9px] text-trade-muted uppercase">Criterio Kelly</div>
                    <div className="text-xs font-mono font-bold text-white">
                        {signal.quantMetrics.kellyPercent.toFixed(1)}% Riesgo
                    </div>
                 </div>
                 <div className="bg-trade-bg p-2 rounded border border-trade-border col-span-2">
                    <div className="text-[9px] text-trade-muted uppercase">Delta Filtro Kalman</div>
                    <div className="text-xs font-mono font-bold text-gray-300">
                       Precio Filtrado: {signal.quantMetrics.kalmanPrice.toFixed(2)}
                    </div>
                 </div>
              </div>
          )}

          {/* Reasoning */}
          <div className="bg-trade-bg p-2 rounded border border-trade-border flex-1">
            <div className="text-[9px] text-trade-muted mb-1">SALIDA MOTOR ESTRATEGIA</div>
            <p className="text-xs text-gray-300 italic leading-tight">"{signal.reasoning}"</p>
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-trade-bg p-1.5 rounded border border-trade-border">
              <div className="text-[9px] text-trade-muted uppercase">SL Dinámico (ATR)</div>
              <div className="text-trade-red font-mono text-xs font-bold">{signal.targets.stopLoss}</div>
            </div>
            <div className="bg-trade-bg p-1.5 rounded border border-trade-border">
              <div className="text-[9px] text-trade-muted uppercase">Objetivo</div>
              <div className="text-trade-green font-mono text-xs font-bold">{signal.targets.takeProfit}</div>
            </div>
          </div>
          
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-trade-muted text-sm text-center">
          <div className="flex flex-col gap-2 items-center">
             <div className="w-8 h-8 border-2 border-t-purple-500 border-trade-border rounded-full animate-spin"></div>
             <p className="text-xs">{loading ? 'Ejecutando Modelos Cuant...' : 'Esperando Flujo de Datos...'}</p>
          </div>
        </div>
      )}
    </div>
  );
};
