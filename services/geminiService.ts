
import { GoogleGenAI, Type } from "@google/genai";
import { AI_SYSTEM_INSTRUCTION } from '../constants';
import { CandleData, AISignal, SignalType, Position, TradeResult } from '../types';
import { calculateRSI, calculateBollingerBands } from '../utils/technicalAnalysis';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to extract indicators for a specific timeframe
const getIndicators = (candles: CandleData[]) => {
    if (candles.length < 20) return null;
    const rsi = calculateRSI(candles, 14);
    const bb = calculateBollingerBands(candles, 20, 2);
    const last = candles.length - 1;
    const currentBB = bb[last];
    
    return {
        price: candles[last].close,
        rsi: rsi[last] || 50,
        bbLower: currentBB.lower,
        bbUpper: currentBB.upper,
        bbWidthPct: ((currentBB.upper - currentBB.lower) / currentBB.middle) * 100,
        trend: candles[last].close > candles[last-5].close ? 'BULLISH' : 'BEARISH'
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
    
    // 1. Analyze Multi-Timeframes
    const m1 = getIndicators(candles1m);
    const m5 = getIndicators(candles5m);
    const m15 = getIndicators(candles15m);

    if (!m1 || !m5 || !m15) {
        console.warn("Insufficient data for multi-frame analysis");
        return null;
    }

    const isHighVolatility = m1.bbWidthPct > 1.5;

    // 2. Prepare Detailed Prompt
    const promptText = `
    ACTIVO: ${symbol}
    CAPITAL: ${balance.toFixed(2)} USDT
    POSICIÓN ACTUAL: ${currentPosition ? currentPosition.type + ' x' + currentPosition.leverage : 'NINGUNA'}

    --- ANÁLISIS MULTI-TEMPORAL ---
    
    [MACRO - 15m] (Tendencia General)
    - Tendencia: ${m15.trend}
    - RSI: ${m15.rsi.toFixed(2)} ${m15.rsi > 70 ? '(SOBRECOMPRA!)' : m15.rsi < 30 ? '(SOBREVENTA!)' : '(NEUTRAL)'}
    - Bollinger: ${m15.price > m15.bbUpper ? 'Rompiendo Arriba' : m15.price < m15.bbLower ? 'Rompiendo Abajo' : 'Dentro de rango'}

    [ESTRUCTURA - 5m] (Soporte/Resistencia)
    - RSI: ${m5.rsi.toFixed(2)}
    - Tendencia: ${m5.trend}

    [MICRO - 1m] (Ejecución/Trigger)
    - Precio: ${m1.price}
    - RSI: ${m1.rsi.toFixed(2)}
    - Volatilidad (BB Width): ${m1.bbWidthPct.toFixed(2)}%

    INSTRUCCIÓN:
    Analiza la confluencia. ¿La entrada en 1m está alineada con 15m?
    Si 15m es bajista, IGNORA señales de compra en 1m a menos que sea un rebote extremo.
    Calcula Take Profit y Stop Loss usando la volatilidad de 5m.
    `;

    // 3. Configure Response Schema
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: [SignalType.BUY, SignalType.SELL, SignalType.HOLD, SignalType.WAIT] },
        confidence: { type: Type.NUMBER },
        leverage: { type: Type.INTEGER, description: "Leverage multiplier between 1 and 20" },
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
        temperature: 0.1, 
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    const signal = JSON.parse(jsonText) as AISignal;
    signal.timestamp = Date.now();
    
    return signal;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};
