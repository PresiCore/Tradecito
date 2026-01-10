
// Market Data Types
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  kalman?: number; // Estimated "True" Value
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

export interface QuantMetrics {
  hurst: number;         // 0-0.5 (Mean Rev), 0.5-1.0 (Trend)
  kalmanPrice: number;   // Denoised Price
  atr: number;           // Volatility
  volatilityIndex: number; // Normalized volatility
  kellyPercent: number;  // Optimal position size %
}

export interface AISignal {
  action: SignalType;
  confidence: number;
  leverage: number; 
  reasoning: string;
  targets: {
    stopLoss: number;
    takeProfit: number;
  };
  quantMetrics?: QuantMetrics; // Attached for UI visualization
  timestamp: number;
}

// Portfolio & Trading Types
export interface Position {
  id: string;
  symbol: string;
  entryPrice: number;
  amount: number; // Total size in crypto units (Leveraged)
  leverage: number; 
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
