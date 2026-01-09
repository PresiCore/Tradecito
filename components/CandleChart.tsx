import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { CandleData, Position } from '../types';
import { calculateBollingerBands } from '../utils/technicalAnalysis';

interface CandleChartProps {
  data: CandleData[];
  activePosition: Position | null;
}

// Custom Shape for Candlestick
const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  
  const isGreen = close >= open;
  const color = isGreen ? '#0ecb81' : '#f6465d';
  
  const totalRange = high - low;
  const pixelRatio = totalRange === 0 ? 0 : height / totalRange;
  
  const bodyTopPrice = Math.max(open, close);
  const bodyBottomPrice = Math.min(open, close);
  
  const bodyTopOffset = (high - bodyTopPrice) * pixelRatio;
  const bodyHeight = Math.max((bodyTopPrice - bodyBottomPrice) * pixelRatio, 1);

  return (
    <g>
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={x} y={y + bodyTopOffset} width={width} height={bodyHeight} fill={color} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-trade-panel border border-trade-border p-2 rounded shadow-lg text-xs font-mono z-50">
        <p className="text-trade-muted mb-1 pb-1 border-b border-gray-700">{new Date(data.time).toLocaleTimeString()}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-trade-muted">Price:</span> <span className="text-white text-right">{data.close.toFixed(2)}</span>
            {data.bbUpper && (
              <>
                 <span className="text-blue-400">BB Upper:</span> <span className="text-blue-400 text-right">{data.bbUpper.toFixed(2)}</span>
                 <span className="text-blue-400">BB Lower:</span> <span className="text-blue-400 text-right">{data.bbLower.toFixed(2)}</span>
              </>
            )}
            <span className="text-trade-muted">Vol:</span> <span className="text-white text-right">{Math.floor(data.volume)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const CandleChart: React.FC<CandleChartProps> = ({ data, activePosition }) => {
  // Calculate BB for visualization
  const chartData = useMemo(() => {
    const bb = calculateBollingerBands(data, 20, 2);
    return data.map((d, i) => ({
        ...d,
        bbUpper: bb[i].upper,
        bbLower: bb[i].lower,
        bbMiddle: bb[i].middle
    }));
  }, [data]);

  if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-trade-muted text-xs animate-pulse">Loading Market Data...</div>;

  // Calculate Domain considering Candles AND Active Position Targets
  let minPrice = Math.min(...data.map(d => d.low));
  let maxPrice = Math.max(...data.map(d => d.high));

  if (activePosition) {
    // Force the domain to include TP, SL and Entry
    minPrice = Math.min(minPrice, activePosition.sl, activePosition.tp, activePosition.entryPrice);
    maxPrice = Math.max(maxPrice, activePosition.sl, activePosition.tp, activePosition.entryPrice);
  }

  // Add padding so lines aren't on the very edge
  const padding = (maxPrice - minPrice) * 0.1;
  const yDomain = [minPrice - padding, maxPrice + padding];

  return (
    <div className="w-full h-full bg-trade-bg rounded-lg overflow-hidden select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 60, left: 0, bottom: 0 }} barGap={0}>
          <XAxis 
            dataKey="time" 
            tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            stroke="#848e9c" 
            tick={{fontSize: 10}}
            minTickGap={50}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis 
            yAxisId="price"
            domain={yDomain} 
            orientation="right" 
            stroke="#848e9c" 
            tick={{fontSize: 10}} 
            tickFormatter={(val) => val.toFixed(2)}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <YAxis yAxisId="volume" orientation="left" domain={[0, (dataMax: number) => dataMax * 4]} hide />
          
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#848e9c', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.3 }} />
          
          <Bar dataKey="volume" yAxisId="volume" barSize={4} isAnimationActive={false}>
             {data.map((entry, index) => (
                <Cell key={`vol-${index}`} fill={entry.close >= entry.open ? '#0ecb81' : '#f6465d'} opacity={0.3} />
             ))}
          </Bar>

          <Bar 
            dataKey={(d) => [d.low, d.high]} 
            yAxisId="price"
            shape={<CandlestickShape />} 
            barSize={6}
            isAnimationActive={false} 
          />
          
          {/* Bollinger Bands */}
          <Line 
            yAxisId="price" 
            type="monotone" 
            dataKey="bbUpper" 
            stroke="#3b82f6" 
            strokeWidth={1} 
            dot={false} 
            strokeOpacity={0.5}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="price" 
            type="monotone" 
            dataKey="bbLower" 
            stroke="#3b82f6" 
            strokeWidth={1} 
            dot={false} 
            strokeOpacity={0.5}
            isAnimationActive={false}
          />
           <Line 
            yAxisId="price" 
            type="monotone" 
            dataKey="bbMiddle" 
            stroke="#eab308" 
            strokeWidth={1} 
            dot={false} 
            opacity={0.6}
            isAnimationActive={false}
          />

          {/* Visualization of TP and SL for CURRENT Asset */}
          {activePosition && (
            <>
              <ReferenceLine 
                yAxisId="price" 
                y={activePosition.tp} 
                stroke="#0ecb81" 
                strokeWidth={2}
                strokeDasharray="4 2"
              >
                <Label value={`TP ${activePosition.tp.toFixed(2)}`} position="insideTopRight" fill="#0ecb81" fontSize={11} fontWeight="bold" offset={-10} />
              </ReferenceLine>

              <ReferenceLine 
                yAxisId="price" 
                y={activePosition.sl} 
                stroke="#f6465d" 
                strokeWidth={2}
                strokeDasharray="4 2"
              >
                 <Label value={`SL ${activePosition.sl.toFixed(2)}`} position="insideBottomRight" fill="#f6465d" fontSize={11} fontWeight="bold" offset={-10} />
              </ReferenceLine>

              <ReferenceLine 
                yAxisId="price" 
                y={activePosition.entryPrice} 
                stroke="#FCD535" 
                strokeWidth={1}
                strokeOpacity={0.8}
              >
                <Label value="ENTRY" position="right" fill="#FCD535" fontSize={10} />
              </ReferenceLine>
            </>
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};