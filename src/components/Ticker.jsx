import React from 'react'
import { formatARS, varInfo } from '../utils/format'

function TickerItem({ label, value, variation }) {
  const v = varInfo(variation)
  return (
    <div className="ticker-item">
      <span className="ticker-label">{label}</span>
      <span className="ticker-val">{value}</span>
      {variation != null && (
        <span className={variation >= 0 ? 'ticker-up' : 'ticker-dn'}>{v.text}</span>
      )}
    </div>
  )
}

export default function Ticker({ liveData, secondsToNext, lastUpdated }) {
  const fiat = liveData?.fiat
  const usdt = liveData?.usdt

  const fmt = (price) => price ? formatARS(price) : '...'

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--'

  const progress = ((secondsToNext ?? 60) / 60) * 100

  return (
    <div className="ticker">
      <div className="ticker-live">
        <div className="ticker-dot" />
        <span className="ticker-time">{timeStr}</span>
      </div>

      <TickerItem label="Oficial"  value={fmt(fiat?.oficial?.price)}   variation={fiat?.oficial?.var} />
      <TickerItem label="Blue"     value={fmt(fiat?.blue?.price)}      variation={fiat?.blue?.var} />
      <TickerItem label="MEP"      value={fmt(fiat?.mep?.price)}       variation={fiat?.mep?.var} />
      <TickerItem label="CCL"      value={fmt(fiat?.ccl?.price)}       variation={fiat?.ccl?.var} />
      <TickerItem label="Mayorista" value={fmt(fiat?.mayorista?.price)} variation={fiat?.mayorista?.var} />
      <TickerItem label="USDT"     value={fmt(usdt?.maxVenta)}          variation={usdt?.var} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 14 }}>
        <div className="ticker-progress">
          <div className="ticker-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
