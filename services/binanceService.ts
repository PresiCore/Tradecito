
import { BINANCE_WS_BASE, BINANCE_API_BASE, DEFAULT_SYMBOL } from '../constants';
import { CandleData, OrderBookData, OrderBookEntry } from '../types';

export const fetchHistoricalCandles = async (symbol: string = DEFAULT_SYMBOL, interval: string = '1m', limit: number = 100): Promise<CandleData[]> => {
  try {
    const response = await fetch(`${BINANCE_API_BASE}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    // Binance returns array of arrays: [time, open, high, low, close, volume, ...]
    return data.map((d: any) => ({
      time: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  } catch (error) {
    console.error("Error fetching historical data:", error);
    return [];
  }
};

// NEW: Multi-Timeframe Fetcher
export const fetchMultiFrameCandles = async (symbol: string) => {
    try {
        const [m1, m5, m15] = await Promise.all([
            fetchHistoricalCandles(symbol, '1m', 50),
            fetchHistoricalCandles(symbol, '5m', 50),
            fetchHistoricalCandles(symbol, '15m', 50)
        ]);
        return { m1, m5, m15 };
    } catch (error) {
        console.error("Error fetching multi-frame data:", error);
        return { m1: [], m5: [], m15: [] };
    }
};

export const subscribeToTicker = (symbol: string, callback: (data: any) => void) => {
  const ws = new WebSocket(`${BINANCE_WS_BASE}/${symbol.toLowerCase()}@ticker`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    callback({
      symbol: message.s,
      price: parseFloat(message.c),
      changePercent: parseFloat(message.P),
      high: parseFloat(message.h),
      low: parseFloat(message.l),
      volume: parseFloat(message.v),
    });
  };

  return () => ws.close();
};

// NEW: Subscribe to multiple tickers at once for portfolio management
export const subscribeToMultiTicker = (symbols: string[], callback: (data: any) => void) => {
    const streams = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`${BINANCE_WS_BASE}/stream?streams=${streams}`);

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // message.data contains the ticker payload
        const ticker = message.data;
        if(ticker) {
            callback({
                symbol: ticker.s,
                price: parseFloat(ticker.c),
                changePercent: parseFloat(ticker.P)
            });
        }
    };

    return () => ws.close();
};

export const subscribeToCandles = (symbol: string, interval: string, callback: (candle: CandleData) => void) => {
  const ws = new WebSocket(`${BINANCE_WS_BASE}/${symbol.toLowerCase()}@kline_${interval}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const k = message.k;
    // Only return if the candle is closed or simply stream updates
    // For live charts, we usually update the current candle
    const candle: CandleData = {
      time: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v)
    };
    callback(candle);
  };

  return () => ws.close();
};

export const subscribeToOrderBook = (symbol: string, callback: (data: OrderBookData) => void) => {
    // Using depth stream for partial book
    const ws = new WebSocket(`${BINANCE_WS_BASE}/${symbol.toLowerCase()}@depth10@100ms`);

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        const formatBook = (list: any[]): OrderBookEntry[] => {
            return list.map(item => ({
                price: parseFloat(item[0]),
                amount: parseFloat(item[1])
            }));
        };

        callback({
            bids: formatBook(message.bids),
            asks: formatBook(message.asks)
        });
    };

    return () => ws.close();
};
