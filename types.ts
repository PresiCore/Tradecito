
// Market Data Types
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  WAIT = 'WAIT'
}

export interface AISignal {
  action: SignalType;
  confidence: number;
  leverage: number; // NEW: Dynamic leverage decided by AI
  reasoning: string;
  targets: {
    stopLoss: number;
    takeProfit: number;
  };
  timestamp: number;
}

// Portfolio & Trading Types
export interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  amount: number; // Total size in crypto units (Leveraged)
  leverage: number; // e.g. 10
  initialMargin: number; // USDT invested from wallet
  type: 'LONG' | 'SHORT'; 
  tp: number;
  sl: number;
  highWaterMark: number; 
  timestamp: number;
}

export interface TradeResult {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number; // Profit/Loss in USDT
  result: 'WIN' | 'LOSS';
  timestamp: number;
}

// AI Service Types
export interface AnalysisRequest {
  symbol: string;
  interval: string;
  data: CandleData[];
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total?: number; // Cumulative for visualization
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}
