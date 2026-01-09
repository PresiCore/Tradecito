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
