// ── Configuration for financial entities and rates ──────────────────────
// Externalized from useTasasData.js for easier maintenance.

/** Which banks/entities appear in the Plazo Fijo section */
export const PF_ALLOWED = [
  'NACION', 'PROVINCIA', 'CIUDAD', 'SANTANDER', 'GALICIA',
  'BBVA', 'MACRO', 'BRUBANK', 'DEL SOL', 'UALA', 'SUPERVIELLE',
]

/** How to display Plazo Fijo entity names */
export const PF_NAME_MAP = {
  NACION: 'Banco Nación',
  PROVINCIA: 'Banco Provincia',
  CIUDAD: 'Banco Ciudad',
  SANTANDER: 'Banco Santander',
  'GALICIA MAS': 'Banco Galicia Más',
  HSBC: 'Banco Galicia Más',
  GALICIA: 'Banco Galicia',
  BBVA: 'BBVA',
  MACRO: 'Banco Macro',
  BRUBANK: 'Brubank',
  'DEL SOL': 'Banco del Sol',
  UALA: 'Ualá',
  SUPERVIELLE: 'Banco Supervielle',
}

/** Which entities appear in the Cuentas Remuneradas section */
export const REMU_FILTER = ['CARREFOUR', 'FIWIND', 'NARANJA', 'UALA']

/** How to display Cuentas Remuneradas entity names */
export const REMU_NAMES = {
  'UALA PLUS 2': 'Ualá Plus 2',
  'UALA PLUS 1': 'Ualá Plus 1',
  'UALA': 'Ualá',
  'NARANJA X': 'Naranja X',
  'FIWIND': 'Fiwind',
  'CARREFOUR': 'Carrefour Banco',
}

/** Fondos Comunes de Inversión to track */
export const FCI_LIST = [
  { key: 'PREX',     name: 'Prex',         desc: 'Allaria Ahorro - Clase E' },
  { key: 'PERSONAL', name: 'Personal Pay',  desc: 'Delta Pesos - Clase X' },
  { key: 'UALA',     name: 'Ualá',          desc: 'Ualintec Ahorro Pesos - Clase A' },
  { key: 'CLARO',    name: 'Claro Pay',     desc: 'SBS Ahorro Pesos - Clase A' },
  { key: 'MERCADO',  name: 'Mercado Pago',  desc: 'Mercado Fondo - Clase A' },
  { key: 'LEMON',    name: 'Lemon',         desc: 'Fima Premium - Clase P' },
  { key: 'FIWIND',   name: 'Fiwind',        desc: 'Delta Pesos - Clase A' },
]

/** Crypto yield entities and configuration */
export const YIELD_ENTITIES = ['Fiwind', 'LB', 'Belo', 'LemonCash', 'Vesseo']
export const YIELD_API_KEY  = { Fiwind: 'fiwind', LB: 'letsbit', Belo: 'belo', LemonCash: 'lemoncash', Vesseo: 'vesseo' }
export const YIELD_DISPLAY  = { LemonCash: 'Lemon' }
export const YIELD_COINS    = ['USDT', 'USDC', 'DAI']
