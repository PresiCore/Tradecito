import React from 'react';
import { Position, TradeResult } from '../types';

interface PortfolioPanelProps {
  balance: number;
  positions: Position[];
  history: TradeResult[];
  onClose: (pos: Position) => void;
}

export const PortfolioPanel: React.FC<PortfolioPanelProps> = ({ balance, positions, history, onClose }) => {
  const initialBalance = 100;
  const totalPnL = balance - initialBalance; // Note: This is realized PnL change + floating margin removed
  const displayEquity = balance + positions.reduce((acc, p) => acc + p.initialMargin, 0); // Approximate equity
  const pnlColor = totalPnL >= 0 ? 'text-trade-green' : 'text-trade-red';

  return (
    <div className="h-48 bg-trade-panel rounded border border-trade-border p-3 flex gap-4 overflow-hidden">
      {/* Balance Section */}
      <div className="w-1/4 flex flex-col justify-center border-r border-trade-border pr-4">
        <div className="text-xs text-trade-muted uppercase tracking-wider mb-1">Available Bal</div>
        <div className="text-2xl font-mono font-bold text-white">{balance.toFixed(2)} <span className="text-xs text-trade-muted">USDT</span></div>
        <div className="text-[10px] text-trade-muted mt-1">Invested: {positions.reduce((acc,p) => acc + p.initialMargin, 0).toFixed(2)}</div>
      </div>

      {/* Active Positions List */}
      <div className="w-2/4 flex flex-col border-r border-trade-border pr-4 px-2 overflow-hidden">
        <div className="text-xs text-trade-muted uppercase tracking-wider mb-1 flex justify-between">
            <span>Active Positions ({positions.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {positions.length === 0 ? (
                <div className="text-trade-muted text-sm italic h-full flex items-center justify-center opacity-50">No active trades</div>
            ) : (
                positions.map((pos) => (
                    <div key={pos.id} className="bg-trade-bg p-1.5 rounded border border-trade-border flex justify-between items-center group hover:border-gray-600 transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-xs ${pos.type === 'LONG' ? 'text-trade-green' : 'text-trade-red'}`}>
                                    {pos.symbol} {pos.type}
                                </span>
                                <span className="text-[8px] bg-purple-900/50 text-purple-300 px-1 rounded">x{pos.leverage}</span>
                            </div>
                            <div className="text-[9px] text-trade-muted mt-0.5">
                                @ {pos.entryPrice} | TP: {pos.tp.toFixed(pos.entryPrice < 1 ? 4 : 2)}
                            </div>
                        </div>
                        <button 
                            onClick={() => onClose(pos)}
                            className="text-[9px] bg-trade-border hover:bg-trade-red text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            CLOSE
                        </button>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* History Log */}
      <div className="w-1/4 flex flex-col overflow-hidden">
        <div className="text-xs text-trade-muted uppercase tracking-wider mb-1">Journal</div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {history.length === 0 ? (
             <span className="text-xs text-trade-muted opacity-50">Empty journal</span>
          ) : (
             history.slice().reverse().slice(0,5).map((trade, i) => (
                <div key={i} className="flex justify-between text-[10px] border-b border-trade-border/50 pb-1 last:border-0">
                  <span className="text-trade-muted">{trade.symbol}</span>
                  <span className={trade.pnl >= 0 ? 'text-trade-green' : 'text-trade-red'}>
                    {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </span>
                </div>
             ))
          )}
        </div>
      </div>
    </div>
  );
};
