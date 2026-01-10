
import { CandleData } from '../types';

export const calculateSMA = (data: CandleData[], period: number): number[] => {
  const smaValues: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaValues.push(NaN); // Not enough data
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    smaValues.push(sum / period);
  }
  return smaValues;
};

export const calculateRSI = (data: CandleData[], period: number = 14): number[] => {
  const rsiValues: number[] = [];
  let gains = 0;
  let losses = 0;

  // First calculation
  if (data.length <= period) return data.map(() => 50);

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Subsequent calculations
  for (let i = 0; i < data.length; i++) {
    if (i <= period) {
      rsiValues.push(NaN);
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }
  }

  return rsiValues;
};

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export const calculateBollingerBands = (data: CandleData[], period: number = 20, multiplier: number = 2): BollingerBands[] => {
  const sma = calculateSMA(data, period);
  return data.map((d, i) => {
    if (i < period - 1) return { upper: NaN, lower: NaN, middle: NaN };
    
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const squaredDiffs = slice.map(c => Math.pow(c.close - mean, 2));
    const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      middle: mean,
      upper: mean + (stdDev * multiplier),
      lower: mean - (stdDev * multiplier)
    };
  });
};

// --- ANTIGRAVITY MATH MODULES ---

// 1. Average True Range (ATR) - For Dynamic Volatility Stops
export const calculateATR = (data: CandleData[], period: number = 14): number[] => {
    const trValues: number[] = [];
    
    for(let i = 0; i < data.length; i++) {
        if (i === 0) {
            trValues.push(data[i].high - data[i].low);
            continue;
        }
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i-1].close;
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trValues.push(tr);
    }

    // Smoothed ATR
    const atrValues: number[] = [];
    let initialATR = 0;
    // Simple average for first period
    for(let i=0; i<period && i<trValues.length; i++) {
        initialATR += trValues[i];
    }
    initialATR /= period;

    for(let i=0; i<data.length; i++) {
        if(i < period) {
            atrValues.push(initialATR); // Approximation for start
        } else {
            const currentTR = trValues[i];
            const prevATR = atrValues[i-1];
            // Wilder's Smoothing
            const nextATR = ((prevATR * (period - 1)) + currentTR) / period;
            atrValues.push(nextATR);
        }
    }
    return atrValues;
};

// 2. Kalman Filter (1D) - For Signal Denoising
export class KalmanFilter {
    private R: number; // Noise covariance (Measurement noise)
    private Q: number; // Process covariance (Prediction noise)
    private A: number = 1; // State vector
    private B: number = 0; // Control vector
    private C: number = 1; // Measurement vector
    
    private cov: number = NaN;
    private x: number = NaN; // Estimated value

    constructor(R: number = 0.01, Q: number = 0.1) {
        this.R = R;
        this.Q = Q;
    }

    filter(measurement: number): number {
        if (isNaN(this.x)) {
            this.x = measurement;
            this.cov = 1;
        } else {
            // Prediction
            const predX = (this.A * this.x) + (this.B * 0);
            const predCov = ((this.A * this.cov) * this.A) + this.Q;

            // Correction
            const K = predCov * this.C * (1 / ((this.C * predCov * this.C) + this.R));
            this.x = predX + K * (measurement - (this.C * predX));
            this.cov = predCov - (K * this.C * predCov);
        }
        return this.x;
    }
}

export const applyKalmanFilter = (data: CandleData[]): number[] => {
    const kf = new KalmanFilter(0.1, 0.1); // Tuned for crypto volatility
    return data.map(d => kf.filter(d.close));
};

// 3. Hurst Exponent - For Regime Detection (Trend vs Mean Reversion)
// Simplified R/S Analysis
export const calculateHurstExponent = (data: CandleData[]): number => {
    if (data.length < 30) return 0.5; // Default random walk
    
    const prices = data.map(d => d.close);
    const n = prices.length;
    
    // Log returns
    const returns: number[] = [];
    for(let i=1; i<n; i++) {
        returns.push(Math.log(prices[i] / prices[i-1]));
    }
    
    const mean = returns.reduce((a,b) => a+b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.map(x => Math.pow(x - mean, 2)).reduce((a,b) => a+b, 0) / returns.length);
    
    // Simplified R/S
    const range = Math.max(...prices) - Math.min(...prices);
    
    // Usually H = log(R/S) / log(n). 
    // This is a rough heuristic approximation for real-time streams without heavy array manipulation
    // H < 0.5 (Mean Reverting), H > 0.5 (Trending)
    
    // Using a simpler heuristic: Volatility scaling
    // Standard implementation is too heavy for client-side tick loop, utilizing simplified Fractal Dimension
    
    // Let's use a simpler "Trend Efficiency" metric mapped to Hurst 0-1
    const netMove = Math.abs(prices[n-1] - prices[0]);
    const totalPath = prices.slice(1).reduce((acc, curr, i) => acc + Math.abs(curr - prices[i]), 0);
    
    const efficiency = netMove / totalPath; // Kaufman Efficiency Ratio
    // Map Efficiency 0..1 to rough Hurst 0.3..0.9
    return 0.4 + (efficiency * 0.5); 
};

// 4. Kelly Criterion (Partial) - For Position Sizing
export const calculateKellyCriterion = (winRate: number, profitRatio: number): number => {
    // f* = p - q/b
    // p = win prob, q = 1-p, b = profit ratio
    const p = winRate;
    const q = 1 - p;
    const b = profitRatio; // e.g. 1.5 for 1.5:1 reward/risk
    
    if (b === 0) return 0;
    
    const f = p - (q / b);
    return Math.max(0, f); // No negative position sizes
};
