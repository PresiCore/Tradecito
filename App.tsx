import React, { useEffect, useState, useRef } from 'react';
import { fetchHistoricalCandles, fetchMultiFrameCandles, subscribeToCandles, subscribeToTicker, subscribeToOrderBook, subscribeToMultiTicker } from './services/binanceService';
import { analyzeMarketData } from './services/geminiService';
import { CandleChart } from './components/CandleChart';
import { OrderBook } from './components/OrderBook';
import { AIPanel } from './components/AIPanel';
import { PortfolioPanel } from './components/PortfolioPanel';
import { CandleData, OrderBookData, TickerData, AISignal, SignalType, Position, TradeResult } from './types';
import { DEFAULT_SYMBOL, DEFAULT_INTERVAL, SUPPORTED_ASSETS, TRADING_FEE_RATE, TRAILING_STOP_GAP, MIN_AI_INTERVAL } from './constants';

const App: React.FC = () => {
  // Market State
  const [currentSymbol, setCurrentSymbol] = useState(DEFAULT_SYMBOL);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  
  // AI & Trading State
  const [aiSignal, setAiSignal] = useState<AISignal | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true); 
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  
  // Portfolio State - MULTIPLE POSITIONS
  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('trade_balance');
    return saved ? parseFloat(saved) : 100;
  });
  
  // Changed from single position to array of positions
  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem('trade_positions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [tradeHistory, setTradeHistory] = useState<TradeResult[]>(() => {
    const saved = localStorage.getItem('trade_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Refs
  const candlesRef = useRef<CandleData[]>([]);
  const positionsRef = useRef<Position[]>(positions);
  const balanceRef = useRef(balance);
  const autoModeRef = useRef(isAutoMode);
  const tradeHistoryRef = useRef<TradeResult[]>(tradeHistory);
  
  const lastScanTimeRef = useRef(0);
  const symbolRef = useRef(DEFAULT_SYMBOL);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Global Price Cache for Multi-Asset TP/SL monitoring
  const pricesRef = useRef<Record<string, number>>({}); 
  const isExecutingRef = useRef(false); // Lock specifically for opening new trades

  // Sync refs & LocalStorage
  useEffect(() => { 
    positionsRef.current = positions; 
    localStorage.setItem('trade_positions', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => { 
    balanceRef.current = balance; 
    localStorage.setItem('trade_balance', balance.toString());
  }, [balance]);

  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
    localStorage.setItem('trade_history', JSON.stringify(tradeHistory));
  }, [tradeHistory]);

  useEffect(() => { autoModeRef.current = isAutoMode; }, [isAutoMode]);
  useEffect(() => { symbolRef.current = currentSymbol; }, [currentSymbol]);

  // --- GLOBAL PRICE MONITOR (For TP/SL on all assets) ---
  useEffect(() => {
      // Subscribe to all supported assets to monitor background positions
      const unsubMulti = subscribeToMultiTicker(SUPPORTED_ASSETS, (data) => {
          // Update global price cache
          pricesRef.current[data.symbol] = data.price;
          
          // Check execution for ALL positions
          checkGlobalAutoExecution(data.symbol, data.price);
      });
      return () => unsubMulti();
  }, []);

  // --- ANALYSIS ENGINE ---
  const handleScanMarket = async () => {
    const now = Date.now();
    const currentPrice = ticker?.price || (candlesRef.current.length > 0 ? candlesRef.current[candlesRef.current.length-1].close : 0);

    // GUARD 1: Position Active on this Symbol
    // Instead of just returning, we generate a SYNTHETIC "HOLD" SIGNAL so the UI looks alive.
    const existingPosition = positionsRef.current.find(p => p.symbol === symbolRef.current);
    if (existingPosition) {
        setValidationMsg("Position Active");
        
        // Calc live PnL for display
        const pnl = (currentPrice - existingPosition.entryPrice) * existingPosition.amount * (existingPosition.type === 'LONG' ? 1 : -1);
        const pnlPct = (pnl / existingPosition.initialMargin) * 100;

        setAiSignal({
            action: SignalType.HOLD,
            confidence: 100,
            leverage: existingPosition.leverage,
            reasoning: `Active Position Monitoring: ${existingPosition.type} @ ${existingPosition.entryPrice}. Current PnL: ${pnl.toFixed(2)} USDT (${pnlPct.toFixed(2)}%). Managing via Trailing Stop.`,
            targets: {
                stopLoss: existingPosition.sl,
                takeProfit: existingPosition.tp
            },
            timestamp: now
        });

        if (autoModeRef.current) {
            // Fast rotation if we already have a position here. 
            // SLOWED DOWN: Wait 6s (was 4s) to let user read the PnL
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = setTimeout(rotateAsset, 6000); 
        }
        return;
    }

    if (isExecutingRef.current) return;

    // GUARD 2: RPM Protection
    // If cooling down, show a WAIT signal instead of empty screen
    const timeElapsed = now - lastScanTimeRef.current;
    if (timeElapsed < MIN_AI_INTERVAL) {
        const remainingTime = MIN_AI_INTERVAL - timeElapsed + 500;
        setIsCoolingDown(true);

        // Only update signal if it's null (first load) to avoid flickering
        setAiSignal(prev => prev || {
             action: SignalType.WAIT,
             confidence: 0,
             leverage: 0,
             reasoning: `Cooling down neural engine... ${(remainingTime/1000).toFixed(1)}s`,
             targets: { stopLoss: 0, takeProfit: 0 },
             timestamp: now
        });

        if (autoModeRef.current) {
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = setTimeout(() => {
                setIsCoolingDown(false);
                handleScanMarket();
            }, remainingTime);
        } else {
             setValidationMsg(`Wait: ${(remainingTime/1000).toFixed(1)}s`);
             setTimeout(() => { setValidationMsg(null); setIsCoolingDown(false); }, 2000);
        }
        return;
    }

    // GUARD 3: No Data
    if (candlesRef.current.length === 0) {
        console.warn(`[HUNTER] No candle data for ${symbolRef.current}. Skipping...`);
        setValidationMsg("No Data - Skipping");
        
        setAiSignal({
            action: SignalType.WAIT,
            confidence: 0,
            leverage: 0,
            reasoning: `Market data stream interrupted for ${symbolRef.current}. Moving to next asset...`,
            targets: { stopLoss: 0, takeProfit: 0 },
            timestamp: now
        });

        if (autoModeRef.current) {
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = setTimeout(rotateAsset, 3000);
        }
        return;
    }
    
    lastScanTimeRef.current = now;
    setIsAiLoading(true);
    setIsCoolingDown(false);
    setValidationMsg(null);

    try {
      const { m5, m15 } = await fetchMultiFrameCandles(symbolRef.current);

      let signal = await analyzeMarketData(
          symbolRef.current, 
          candlesRef.current, 
          m5,                 
          m15,                
          null,
          balanceRef.current,
          tradeHistoryRef.current 
      );
      
      // Fallback if API fails
      if (!signal) {
          signal = {
              action: SignalType.WAIT,
              confidence: 0,
              leverage: 1,
              reasoning: "Neural analysis inconclusive or data insufficient. Continuing scan...",
              targets: { stopLoss: 0, takeProfit: 0 },
              timestamp: Date.now()
          };
      }
      
      setAiSignal(signal);

      if (autoModeRef.current) {
          const isActionable = signal?.action === SignalType.BUY || signal?.action === SignalType.SELL;

          if (isActionable && signal) {
              
              // AGGRESSIVE: Confidence > 65%
              if (signal.confidence < 65) {
                   setValidationMsg(`Low Conf: ${signal.confidence}%`);
                   setAiSignal(prev => prev ? ({...prev, reasoning: `[SKIPPED: Conf < 65%] ${prev.reasoning}`}) : null);
                   
                   // SLOWED DOWN: Wait 8s (was 5s) to let user read the reasoning
                   if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                   scanTimeoutRef.current = setTimeout(rotateAsset, 8000);
                   return;
              }

              const executionPrice = pricesRef.current[symbolRef.current] || ticker?.price || candlesRef.current[candlesRef.current.length-1].close;
              
              // FORCE EXECUTION LOGIC (Auto-Adjust instead of Reject)
              const minDistance = executionPrice * 0.0005; 
              
              let finalTP = signal.targets.takeProfit;
              let finalSL = signal.targets.stopLoss;
              let adjusted = false;

              if (signal.action === SignalType.BUY) {
                  if (finalTP <= executionPrice + minDistance) {
                      finalTP = executionPrice + (minDistance * 3); 
                      adjusted = true;
                  }
                  if (finalSL >= executionPrice - minDistance) {
                      finalSL = executionPrice - (minDistance * 2);
                      adjusted = true;
                  }
              } else { // SELL
                  if (finalTP >= executionPrice - minDistance) {
                      finalTP = executionPrice - (minDistance * 3);
                      adjusted = true;
                  }
                  if (finalSL <= executionPrice + minDistance) {
                      finalSL = executionPrice + (minDistance * 2);
                      adjusted = true;
                  }
              }

              if (adjusted) {
                  console.log(`[EXECUTION] Targets adjusted for safety on ${symbolRef.current}`);
                  setAiSignal(prev => prev ? ({
                      ...prev, 
                      targets: { takeProfit: finalTP, stopLoss: finalSL },
                      reasoning: `[AUTO-ADJUSTED TARGETS] ${prev.reasoning}`
                  }) : null);
              }

              // --- EXECUTION ---
              isExecutingRef.current = true; // Lock opening new trades briefly
              if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

              const selectedLeverage = Math.min(Math.max(1, signal.leverage), 20); 
              const margin = Math.min(balanceRef.current * 0.20, 20); 
              
              if (margin < 5) {
                   console.log("Insufficient funds for new position");
                   setValidationMsg("No Funds");
                   isExecutingRef.current = false;
                   scanTimeoutRef.current = setTimeout(rotateAsset, 8000);
                   return;
              }

              const notionalValue = margin * selectedLeverage; 
              const amount = notionalValue / executionPrice;
              const type = signal.action === SignalType.BUY ? 'LONG' : 'SHORT';

              const newPos: Position = {
                  id: Math.random().toString(36).substr(2, 9),
                  symbol: symbolRef.current,
                  entryPrice: executionPrice,
                  amount: amount,
                  leverage: selectedLeverage,
                  initialMargin: margin,
                  type: type,
                  tp: finalTP,
                  sl: finalSL,
                  highWaterMark: executionPrice, 
                  timestamp: Date.now()
              };
              
              setPositions(prev => [...prev, newPos]);
              setBalance(prev => prev - margin); // Deduct used margin
              
              console.log(`OPENED: ${type} ${symbolRef.current} @ ${executionPrice}`);
              
              // Unlock and rotate after a delay to watch the trade start.
              // SLOWED DOWN: Wait 12s (was 8s) to celebrate the trade
              setTimeout(() => {
                  isExecutingRef.current = false;
                  if (autoModeRef.current) rotateAsset();
              }, 12000); 

          } else {
              // NO SIGNAL -> ROTATE
              // SLOWED DOWN: Wait 8s (was 5s)
              if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
              scanTimeoutRef.current = setTimeout(rotateAsset, 8000); 
          }
      }

    } catch (e) {
      console.error(e);
      setAiSignal({
          action: SignalType.WAIT,
          confidence: 0,
          leverage: 1,
          reasoning: "System Alert: Analysis Engine interrupted. Rotating to next asset...",
          targets: { stopLoss: 0, takeProfit: 0 },
          timestamp: Date.now()
      });

      if(autoModeRef.current) {
          scanTimeoutRef.current = setTimeout(rotateAsset, 8000); 
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const rotateAsset = () => {
    if (isExecutingRef.current) return;

    if (autoModeRef.current) {
        const currentIndex = SUPPORTED_ASSETS.indexOf(symbolRef.current);
        const nextIndex = (currentIndex + 1) % SUPPORTED_ASSETS.length;
        const nextAsset = SUPPORTED_ASSETS[nextIndex];
        console.log(`[HUNTER] >> ${nextAsset}`);
        setCurrentSymbol(nextAsset);
    }
  };

  // --- INIT DATA ON SYMBOL CHANGE ---
  useEffect(() => {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    
    setTicker(null); 
    // IMMEDIATE FEEDBACK: Don't set to null, set to 'Scanning' so UI doesn't look dead
    setAiSignal({
        action: SignalType.WAIT,
        confidence: 0,
        leverage: 0,
        reasoning: `Scanning market structure for ${currentSymbol}...`,
        targets: { stopLoss: 0, takeProfit: 0 },
        timestamp: Date.now()
    });
    setValidationMsg(null);
    setIsCoolingDown(false);
    candlesRef.current = [];

    const initData = async () => {
      const history = await fetchHistoricalCandles(currentSymbol, DEFAULT_INTERVAL);
      
      // DEADLOCK PREVENTION
      if (!history || history.length === 0) {
          console.warn(`[HUNTER] Init failed for ${currentSymbol}. Skipping...`);
          setValidationMsg("Data Fetch Failed");
          // Ensure signal is explicit about failure
          setAiSignal(prev => ({...prev!, reasoning: "Connection failed. Retrying..."}));
          if (autoModeRef.current) {
             scanTimeoutRef.current = setTimeout(rotateAsset, 3000);
          }
          return;
      }

      setCandles(history);
      candlesRef.current = history;
      
      // Wait 2.5s then scan
      if (autoModeRef.current) {
          scanTimeoutRef.current = setTimeout(() => handleScanMarket(), 2500);
      }
    };
    initData();

    // Subscribe to Main Ticker for UI
    const unsubTicker = subscribeToTicker(currentSymbol, (data) => {
      setTicker(data);
      pricesRef.current[data.symbol] = data.price;
    });

    const unsubOrderBook = subscribeToOrderBook(currentSymbol, (data) => setOrderBook(data));
    const unsubCandles = subscribeToCandles(currentSymbol, DEFAULT_INTERVAL, (newCandle) => {
      setCandles(prev => {
        const last = prev[prev.length - 1];
        if (last && last.time === newCandle.time) {
          const updated = [...prev];
          updated[updated.length - 1] = newCandle;
          candlesRef.current = updated;
          return updated;
        } else {
          const updated = [...prev, newCandle];
          if (updated.length > 200) updated.shift();
          candlesRef.current = updated;
          return updated;
        }
      });
    });

    return () => {
      unsubTicker();
      unsubOrderBook();
      unsubCandles();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [currentSymbol]);

  // --- GLOBAL EXECUTION CHECKER ---
  const checkGlobalAutoExecution = (symbol: string, currentPrice: number) => {
      const activePositions = positionsRef.current;
      const pos = activePositions.find(p => p.symbol === symbol);
      
      if (!pos) return;

      let closed = false;
      let result: 'WIN' | 'LOSS' | null = null;
      let updatedPos = { ...pos };
      let positionUpdated = false;

      // Trailing Stop Logic
      if (pos.type === 'LONG') {
          if (currentPrice > pos.highWaterMark) {
              updatedPos.highWaterMark = currentPrice;
              positionUpdated = true;
              const potentialSL = currentPrice * (1 - TRAILING_STOP_GAP);
              if (potentialSL > pos.sl) {
                  updatedPos.sl = potentialSL;
                  positionUpdated = true;
              }
          }
          if (currentPrice >= pos.tp) { closed = true; result = 'WIN'; }
          else if (currentPrice <= pos.sl) { closed = true; result = 'LOSS'; }
      } else { // SHORT
          if (currentPrice < pos.highWaterMark) {
              updatedPos.highWaterMark = currentPrice;
              positionUpdated = true;
              const potentialSL = currentPrice * (1 + TRAILING_STOP_GAP);
              if (potentialSL < pos.sl) {
                  updatedPos.sl = potentialSL;
                  positionUpdated = true;
              }
          }
          if (currentPrice <= pos.tp) { closed = true; result = 'WIN'; }
          else if (currentPrice >= pos.sl) { closed = true; result = 'LOSS'; }
      }

      // Liquidation Check
      const notional = pos.amount * currentPrice;
      const entryNotional = pos.amount * pos.entryPrice;
      let floatingPnL = 0;
      if (pos.type === 'LONG') floatingPnL = notional - entryNotional;
      else floatingPnL = entryNotional - notional;

      if (floatingPnL <= -pos.initialMargin * 0.9) {
          closed = true; result = 'LOSS';
      }

      if (closed && result) {
          closePositionInternal(currentPrice, result, pos);
      } else if (positionUpdated) {
          setPositions(prev => prev.map(p => p.id === pos.id ? updatedPos : p));
      }
  };

  const closePositionInternal = (exitPrice: number, result: 'WIN' | 'LOSS', pos: Position) => {
    const entryNotional = pos.amount * pos.entryPrice; 
    const exitNotional = pos.amount * exitPrice; 
    
    const entryFee = entryNotional * TRADING_FEE_RATE;
    const exitFee = exitNotional * TRADING_FEE_RATE;
    const totalFees = entryFee + exitFee;
    
    let grossPnL = 0;
    if (pos.type === 'LONG') grossPnL = exitNotional - entryNotional;
    else grossPnL = entryNotional - exitNotional; 
    
    const netPnL = grossPnL - totalFees;
    
    const returnAmount = pos.initialMargin + netPnL;
    
    setBalance(prev => Math.max(0, prev + returnAmount));
    setPositions(prev => prev.filter(p => p.id !== pos.id));
    
    const record: TradeResult = {
        id: pos.id,
        symbol: pos.symbol,
        entryPrice: pos.entryPrice,
        exitPrice: exitPrice,
        pnl: netPnL,
        result: netPnL >= 0 ? 'WIN' : 'LOSS',
        timestamp: Date.now()
    };
    setTradeHistory(prev => [...prev, record]);
    
    console.log(`CLOSED ${pos.symbol} (${result}): ${netPnL.toFixed(2)} USDT`);
    
    if (pos.symbol === symbolRef.current) {
        setAiSignal(prev => prev ? { ...prev, action: SignalType.WAIT, reasoning: `Closed ${pos.symbol}. Net: ${netPnL.toFixed(2)}` } : null);
    }
  };

  const manualClose = (targetPos: Position) => {
      const price = pricesRef.current[targetPos.symbol];
      if (!price) {
          alert("Price data not yet available for " + targetPos.symbol);
          return;
      }
      let isWin = false;
      if (targetPos.type === 'LONG') isWin = price > targetPos.entryPrice;
      else isWin = price < targetPos.entryPrice;
      
      closePositionInternal(price, isWin ? 'WIN' : 'LOSS', targetPos);
  };

  const toggleAutoMode = () => {
    setIsAutoMode(prev => {
        const next = !prev;
        if (!next && scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        return next;
    });
  };

  const resetAccount = () => {
      if(confirm("Reset account to 100 USDT and clear history?")) {
          setBalance(100);
          setPositions([]);
          setTradeHistory([]);
          localStorage.clear();
          window.location.reload();
      }
  };

  const currentChartPosition = positions.find(p => p.symbol === currentSymbol) || null;

  return (
    <div className="min-h-screen bg-trade-bg text-trade-text font-sans flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-trade-border bg-trade-panel flex items-center px-4 justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l-2.4 7.2h4.8L12 2zm-1.8 8.4L6.6 22h10.8l-3.6-11.6H10.2z"/></svg>
            <h1 className="font-bold text-lg tracking-tight text-white hidden sm:block">BINANCE<span className="text-yellow-500">AI</span> PRO</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
                value={currentSymbol} 
                onChange={(e) => setCurrentSymbol(e.target.value)}
                className="bg-trade-bg border border-trade-border hover:border-gray-500 text-white text-xs font-bold py-1 px-2 rounded focus:outline-none"
            >
                {SUPPORTED_ASSETS.map(asset => (
                    <option key={asset} value={asset}>{asset}</option>
                ))}
            </select>
            {isAutoMode && (
                 <div className="flex items-center gap-1 text-[10px] text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                    HUNTER: {currentSymbol}
                 </div>
            )}
            {positions.length > 0 && (
                <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-500/30 px-2 rounded">
                    {positions.length} ACTIVE
                </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
                onClick={toggleAutoMode}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    isAutoMode 
                    ? 'bg-yellow-500 text-black border-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                    : 'bg-transparent text-trade-muted border-trade-border hover:border-gray-500'
                }`}
            >
                <div className={`w-2 h-2 rounded-full ${isAutoMode ? 'bg-black' : 'bg-gray-500'}`}></div>
                {isAutoMode ? 'AI ACTIVE' : 'MANUAL'}
            </button>
            <button onClick={resetAccount} className="text-trade-muted hover:text-white text-xs underline">
                Reset
            </button>
          </div>
        </div>

        {ticker && (
          <div className="flex items-center gap-6 text-xs font-mono">
             <div>
                <span className="text-trade-muted block text-[10px]">PRICE</span>
                <span className={`text-base font-bold ${ticker.changePercent >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
                  {ticker.price.toFixed(ticker.price < 1 ? 6 : 2)}
                </span>
             </div>
             <div className="hidden sm:block">
                <span className="text-trade-muted block text-[10px]">24h CHANGE</span>
                <span className={ticker.changePercent >= 0 ? 'text-trade-green' : 'text-trade-red'}>
                  {ticker.changePercent > 0 ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                </span>
             </div>
          </div>
        )}
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-1 md:p-2 grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 max-h-[calc(100vh-3.5rem)] overflow-hidden">
        
        {/* Left: Chart Area */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col gap-1">
          <div className="flex-1 bg-trade-panel rounded border border-trade-border p-2 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-2 px-2 shrink-0">
               <div className="flex gap-2 items-center">
                 <span className="text-sm font-bold text-white">{currentSymbol}</span>
                 <span className="text-xs text-trade-muted bg-trade-bg px-1 rounded border border-trade-border pt-0.5">1m</span>
                 <span className="text-[10px] text-yellow-500 ml-2 border border-yellow-500/30 px-1 rounded">BB(20,2)</span>
                 {currentChartPosition && (
                     <span className="text-[10px] bg-purple-900/50 text-purple-300 border border-purple-500/50 px-1 rounded ml-1 animate-pulse">x{currentChartPosition.leverage}</span>
                 )}
                 {validationMsg && (
                    <span className="text-[10px] text-trade-red bg-red-900/30 px-2 rounded border border-red-800 animate-pulse">{validationMsg}</span>
                 )}
               </div>
            </div>
            <div className="flex-1 min-h-0 w-full relative">
              <CandleChart data={candles} activePosition={currentChartPosition} />
            </div>
          </div>
          
          <div className="hidden md:block">
             <PortfolioPanel balance={balance} positions={positions} history={tradeHistory} onClose={manualClose} />
          </div>
        </div>

        {/* Right: OrderBook & AI */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-1 h-full overflow-hidden">
          <div className="flex-1 min-h-[300px] bg-trade-panel rounded border border-trade-border flex flex-col">
            <div className="p-2 border-b border-trade-border flex justify-between items-center">
              <h3 className="text-xs font-bold text-trade-text">Order Book</h3>
              <span className="text-[10px] text-trade-muted">Real-time</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <OrderBook data={orderBook} currentPrice={ticker?.price || 0} />
            </div>
          </div>

          <div className="h-[350px] shrink-0">
             <AIPanel 
                signal={aiSignal} 
                loading={isAiLoading} 
                onAnalyze={handleScanMarket} 
             />
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;