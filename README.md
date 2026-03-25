# Dashboard Financiero — v2.0

Stack: React 18 + Vite + Chart.js (vanilla CSS, sin Tailwind para máxima compatibilidad con GitHub Pages)

## Estructura

```
dashboard-financiero/
├── public/
│   ├── data/              ← JSONs generados por build_data.py
│   │   ├── snapshot.json
│   │   ├── events.json
│   │   ├── meta.json
│   │   └── usdt_history.json
│   └── assets/
│       └── bybit.png
├── src/
│   ├── charts/
│   │   ├── InflacionChart.jsx   ← Barras IPC 12m con año agrupado
│   │   ├── SpreadChart.jsx      ← Spread CCL vs base con zonas
│   │   └── BandasChart.jsx      ← Bandas BCRA: gauge + chart + tabla
│   ├── components/
│   │   ├── Ticker.jsx           ← Barra superior en tiempo real
│   │   └── Sidebar.jsx          ← Navegación lateral
│   ├── hooks/
│   │   ├── useSnapshot.js       ← Carga snapshot.json
│   │   ├── useLiveData.js       ← Fetch live cada 60s
│   │   └── useTasasData.js      ← Plazo fijo, cuentas, FCI, yields
│   ├── tabs/
│   │   ├── TabResumen.jsx       ← KPIs + IPC + cotizaciones + bandas mini
│   │   ├── TabDolares.jsx       ← Cotizaciones + spread + bandas completo
│   │   ├── TabTasas.jsx         ← Cuentas, PF, FCI, stablecoins
│   │   └── TabCalendario.jsx    ← Feriados del mes corriente
│   ├── utils/
│   │   ├── format.js            ← Helpers de formato
│   │   ├── bandas.js            ← Cálculo de bandas BCRA
│   │   └── icons.jsx            ← Mapa de íconos SVG
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── build_data.py                ← Genera los JSONs (correr diariamente)
├── index.html
├── package.json
└── vite.config.js
```

## Instalación y desarrollo

```bash
# 1. Instalar dependencias
npm install

# 2. Servidor de desarrollo con hot reload
npm run dev

# 3. Build de producción
npm run build

# 4. Preview del build
npm run preview
```

## Build de datos

```bash
# Instalar deps Python
pip install -r requirements.txt

# Generar JSONs (ejecutar desde la raíz del proyecto)
python build_data.py

# O con directorio personalizado
python build_data.py --out-dir public/data
```

## Deploy en GitHub Pages

1. Hacer `npm run build` → genera carpeta `dist/`
2. Subir contenido de `dist/` a la rama `gh-pages`
3. O configurar GitHub Actions para build automático

## Notas

- El ticker se actualiza cada 60 segundos automáticamente
- Los datos de snapshot se construyen con `build_data.py` (idealmente un cron diario via GitHub Actions)
- El histórico USDT se persiste en `public/data/usdt_history.json`
- Los feriados muestran solo el mes corriente, eliminando los ya pasados
- Riesgo país fue removido del dashboard
