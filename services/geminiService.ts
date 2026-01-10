
import { GoogleGenAI, Type } from "@google/genai";
import { AI_SYSTEM_INSTRUCTION } from '../constants';
import { CandleData, AISignal, SignalType, Position, TradeResult, QuantMetrics } from '../types';
import { calculateRSI, calculateBollingerBands, applyKalmanFilter, calculateHurstExponent, calculateATR, calculateKellyCriterion } from '../utils/technicalAnalysis';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to extract indicators for a specific timeframe
const getQuantState = (candles: CandleData[]) => {
    if (candles.length < 30) return null;
    
    // Standard Indicators
    const rsi = calculateRSI(candles, 14);
    const bb = calculateBollingerBands(candles, 20, 2);
    
    // Antigravity Math Modules
    const kalmanValues = applyKalmanFilter(candles);
    const hurst = calculateHurstExponent(candles);
    const atr = calculateATR(candles, 14);
    
    const last = candles.length - 1;
    const currentPrice = candles[last].close;
    const currentKalman = kalmanValues[last];
    const currentATR = atr[last];
    const prevKalman = kalmanValues[last-1];
    
    // Visual Geometry Description for the Agent
    const priceVsKalman = currentPrice > currentKalman ? "ABOVE" : "BELOW";
    const kalmanSlope = currentKalman > prevKalman ? "ASCENDING" : "DESCENDING";
    const volatilityState = hurst > 0.55 ? "TRENDING" : hurst < 0.45 ? "MEAN_REVERTING" : "RANDOM_WALK";

    // Kelly Calculation (Simulated Win Rate based on Trend Strength)
    // Stronger trend (Hurst > 0.6) implies higher probability
    const estimatedWinRate = 0.5 + ((hurst - 0.5) * 0.8); 
    const kelly = calculateKellyCriterion(estimatedWinRate, 1.5); // 1.5 R:R ratio assumed

    return {
        price: currentPrice,
        rsi: rsi[last] || 50,
        bbLower: bb[last].lower,
        bbUpper: bb[last].upper,
        kalman: currentKalman,
        hurst: hurst,
        atr: currentATR,
        kellyPct: kelly * 100, // as percentage
        visualState: {
            position: priceVsKalman,
            slope: kalmanSlope,
            regime: volatilityState
        }
    };
};

export const analyzeMarketData = async (
  symbol: string, 
  candles1m: CandleData[], 
  candles5m: CandleData[],
  candles15m: CandleData[],
  currentPosition: Position | null,
  balance: number,
  tradeHistory: TradeResult[]
): Promise<AISignal | null> => {
  try {
    
    // 1. Run Quantitative Analysis Layers
    const s1m = getQuantState(candles1m);
    const s5m = getQuantState(candles5m);
    const s15m = getQuantState(candles15m);

    if (!s1m || !s5m || !s15m) {
        console.warn("Insufficient data for Antigravity core");
        return null;
    }

    // 2. Construct The "Tuple" State S_t Prompt
    // We simulate the "Visual" tensor by describing the geometry explicitly
    const promptText = `
    SYSTEM: ANTIGRAVITY QUANT CORE v1.0
    ASSET: ${symbol} | BALANCE: ${balance.toFixed(2)} USDT
    
    --- ESTADO St (INPUT TUPLE) ---

    [LAYER 1: PERCEPCIÓN VISUAL & FILTROS] (15m Macro)
    - Kalman Filter State: Price is ${s15m.visualState.position} the Denoised Trendline.
    - Kalman Slope: ${s15m.visualState.slope} (Vector Direction).
    - Hurst Exponent: ${s15m.hurst.toFixed(3)} -> REGIME: ${s15m.visualState.regime}.
    - ATR (Volatility): ${s15m.atr.toFixed(4)}.

    [LAYER 2: PROBABILIDAD ESTOCÁSTICA] (5m Structure)
    - RSI: ${s5m.rsi.toFixed(2)}.
    - Kelly Criterion Suggestion: Risk ${s5m.kellyPct.toFixed(2)}% of capital.
    - Bollinger Width: ${((s5m.bbUpper - s5m.bbLower)).toFixed(4)}.

    [LAYER 3: MICRO-ESTRUCTURA] (1m Trigger)
    - Price: ${s1m.price} vs Kalman: ${s1m.kalman.toFixed(4)}.
    - Divergence check: Price ${s1m.visualState.position} Kalman.

    INSTRUCCIÓN DE AGENTE (PPO LOGIC):
    Calcula la Acción Óptima a(t). 
    Si Hurst > 0.6 (Tendencia Fuerte), ignora osciladores y sigue el Slope de Kalman.
    Si Hurst < 0.4 (Rango), ignora Kalman y opera reversión a la media (Bollinger).
    Define Stop Loss usando ATR: SL = Precio +/- (K * ATR).
    `;

    // 3. Configure Response Schema
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: [SignalType.BUY, SignalType.SELL, SignalType.HOLD, SignalType.WAIT] },
        confidence: { type: Type.NUMBER },
        leverage: { type: Type.INTEGER },
        reasoning: { type: Type.STRING },
        targets: {
            type: Type.OBJECT,
            properties: {
                stopLoss: { type: Type.NUMBER },
                takeProfit: { type: Type.NUMBER }
            }
        }
      },
      required: ['action', 'confidence', 'leverage', 'reasoning', 'targets']
    };

    // 4. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: promptText,
      config: {
        systemInstruction: AI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Lower temperature for more deterministic/math-based Logic
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    const signal = JSON.parse(jsonText) as AISignal;
    signal.timestamp = Date.now();
    
    // Attach Quant Metrics for Frontend Visualization
    signal.quantMetrics = {
        hurst: s15m.hurst,
        kalmanPrice: s1m.kalman,
        atr: s5m.atr,
        volatilityIndex: s5m.atr / s5m.price,
        kellyPercent: s5m.kellyPct
    };
    
    return signal;

  } catch (error) {
    console.error("Antigravity Core Error:", error);
    return null;
  }
};
