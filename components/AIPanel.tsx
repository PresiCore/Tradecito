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
        <h2 className="text-white font-bold flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-blue-500'} animate-pulse`}></span>
          AI DIRECTOR
        </h2>
        <button 
          onClick={onAnalyze}
          disabled={loading}
          className={`px-3 py-1 text-xs font-bold rounded transition-colors ${loading ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
        >
          {loading ? 'ANALYZING...' : 'FORCE SCAN'}
        </button>
      </div>

      {signal ? (
        <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-500">
          {/* Signal Header */}
          <div className={`border-l-4 pl-4 py-2 ${getSignalColor(signal.action)} bg-trade-bg rounded-r relative`}>
             {(signal.action === SignalType.BUY || signal.action === SignalType.SELL) && (
               <div className={`absolute right-2 top-2 px-2 py-0.5 rounded border text-[10px] font-bold ${getLeverageColor(signal.leverage || 1)}`}>
                  {signal.leverage}x LEVERAGE
               </div>
             )}
            <div className="text-xs text-trade-muted uppercase tracking-wider">Strategic Signal</div>
            <div className="text-4xl font-black tracking-tighter">{signal.action}</div>
            <div className="text-sm font-mono mt-1 opacity-80">Confidence: {signal.confidence}%</div>
          </div>

          {/* Reasoning */}
          <div className="bg-trade-bg p-3 rounded border border-trade-border">
            <div className="text-xs text-trade-muted mb-1">RISK & STRATEGY</div>
            <p className="text-sm text-gray-300 italic">"{signal.reasoning}"</p>
          </div>

          {/* Targets */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-trade-bg p-2 rounded border border-trade-border">
              <div className="text-[10px] text-trade-muted uppercase">Stop Loss</div>
              <div className="text-trade-red font-mono font-bold">{signal.targets.stopLoss}</div>
            </div>
            <div className="bg-trade-bg p-2 rounded border border-trade-border">
              <div className="text-[10px] text-trade-muted uppercase">Take Profit</div>
              <div className="text-trade-green font-mono font-bold">{signal.targets.takeProfit}</div>
            </div>
          </div>
          
          <div className="text-[10px] text-trade-muted text-center mt-2 flex justify-between">
            <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
            {signal.action !== SignalType.BUY && signal.action !== SignalType.SELL && (
                 <span className="text-yellow-500 animate-pulse">Scanning next asset...</span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-trade-muted text-sm text-center">
          <div className="flex flex-col gap-2 items-center">
             <div className="w-8 h-8 border-2 border-t-blue-500 border-trade-border rounded-full animate-spin"></div>
             <p>{loading ? 'Processing Data...' : 'Initializing Hunter Protocol...'}</p>
          </div>
        </div>
      )}
    </div>
  );
};