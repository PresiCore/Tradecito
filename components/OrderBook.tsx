
import React from 'react';
import { OrderBookData } from '../types';

interface OrderBookProps {
  data: OrderBookData | null;
  currentPrice: number;
}

export const OrderBook: React.FC<OrderBookProps> = ({ data, currentPrice }) => {
  if (!data) return <div className="text-trade-muted text-xs p-4">Cargando Libro...</div>;

  // Take top 8 asks (reversed for display from high to low price) and top 8 bids
  const asks = [...data.asks].slice(0, 12).reverse();
  const bids = data.bids.slice(0, 12);

  const maxAmt = Math.max(
    ...asks.map(a => a.amount),
    ...bids.map(b => b.amount)
  );

  const Row: React.FC<{ price: number; amount: number; type: 'ask' | 'bid' }> = ({ price, amount, type }) => {
    const bgWidth = `${(amount / maxAmt) * 100}%`;
    const color = type === 'ask' ? 'bg-trade-red' : 'bg-trade-green';
    const textColor = type === 'ask' ? 'text-trade-red' : 'text-trade-green';

    return (
      <div className="relative flex justify-between items-center text-xs py-0.5 px-2 hover:bg-trade-panel cursor-pointer">
        <div className={`absolute top-0 right-0 h-full opacity-10 ${color}`} style={{ width: bgWidth }}></div>
        <span className={`z-10 font-mono ${textColor}`}>{price.toFixed(2)}</span>
        <span className="z-10 text-trade-text">{amount.toFixed(4)}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-trade-bg">
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {asks.map((ask, i) => <Row key={i} price={ask.price} amount={ask.amount} type="ask" />)}
      </div>
      
      <div className="py-2 px-2 text-center font-bold text-lg text-white border-y border-trade-border my-1">
        {currentPrice.toFixed(2)} 
        <span className="text-xs text-trade-muted ml-2">USD</span>
      </div>

      <div className="flex-1 overflow-hidden">
        {bids.map((bid, i) => <Row key={i} price={bid.price} amount={bid.amount} type="bid" />)}
      </div>
    </div>
  );
};
