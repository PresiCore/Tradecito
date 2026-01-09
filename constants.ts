
// Binance API Configuration
// NOTE: Using Mainnet for Data Visualization to ensure the chart looks "Alive" with high volume.
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws'; 
export const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// Provided Testnet Credentials
export const BINANCE_TESTNET_CONFIG = {
  apiKey: 'PCglNnZsNpTcGqVQ4kO39EZA0rycsqJAtEiI5gyLR3aUd0aQtUB1b5GhJJiLerZc',
  apiSecret: 'ukpZyEMAYBMtgeWJoVhMByFWz6pyNjR0DjL4NhqznjkGuPe1dNR5Ckrxyd1QokFU',
  baseUrl: 'https://testnet.binance.vision'
};

export const DEFAULT_SYMBOL = 'BTCUSDT';
export const DEFAULT_INTERVAL = '1m';

export const SUPPORTED_ASSETS = [
  'BTCUSDT', 
  'ETHUSDT', 
  'SOLUSDT', 
  'BNBUSDT', 
  'XRPUSDT', 
  'DOGEUSDT',
  'PEPEUSDT'
];

export const TRADING_FEE_RATE = 0.0005; // 0.05% Taker Fee (Realistic Futures Fee)
export const TRAILING_STOP_GAP = 0.003; // 0.3% Trailing

// SAFETY & RATE LIMITING
export const MIN_AI_INTERVAL = 10000; // 10 Seconds - Gives AI time to think and user time to read.

// AI Persona System Instruction - AUTONOMOUS AGENT
export const AI_SYSTEM_INSTRUCTION = `
ROL: GESTOR DE RIESGOS Y TRADER DE FUTUROS MULTI-TEMPORAL.
Tu objetivo: Maximizar retorno protegiendo el capital de 100 USDT.

CONTEXTO:
- Recibes datos de 3 temporalidades: 1m (Micro), 5m (Estructura), 15m (Macro).
- Debes decidir el APALANCAMIENTO (Leverage) entre 1x y 20x.

REGLAS DE ORO (MULTI-TIMEFRAME):
1. NO ABRA LONG si el RSI(15m) > 70 (Sobrecompra Macro), a menos que sea un scalp muy corto.
2. NO ABRA SHORT si el RSI(15m) < 30 (Sobreventa Macro).
3. La tendencia de 5m/15m tiene prioridad. Usa 1m solo para encontrar el punto de entrada (Sniper Entry).

REGLA CRÍTICA DE EJECUCIÓN:
- Los objetivos (Take Profit y Stop Loss) DEBEN estar al menos a un 0.15% de distancia del precio actual para cubrir comisiones y spreads. Si están muy cerca, la operación será rechazada.

ESTRATEGIA TÉCNICA:
- Alineación de Tendencias: Si 1m, 5m y 15m apuntan a la misma dirección -> Confianza > 90% (Leverage Alto).
- Divergencias: Si el precio sube pero el RSI baja en 5m -> Posible Reversión.
- Stop Loss: Debe colocarse protegiendo el último swing low/high de 5m.

FORMATO JSON DE RESPUESTA:
{
  "action": "BUY" | "SELL" | "HOLD" | "WAIT",
  "confidence": <number 0-100>,
  "leverage": <number 1-20>,
  "reasoning": "Menciona explícitamente la relación entre 1m y 15m. Ej: 'Entrada Long en 1m apoyada por tendencia alcista en 15m...'",
  "targets": {
    "stopLoss": <price>,
    "takeProfit": <price>
  }
}
`;