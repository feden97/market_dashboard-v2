import React, { useMemo } from 'react'

const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTH_SHORT    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const WEEKDAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export default function TabCalendario({ snapshot }) {
  const macro = snapshot?.argentina_macro

  const holidays = useMemo(() => {
    const full = macro?.full_holidays ?? []
    const today = new Date()
    today.setHours(0,0,0,0)
    const curMonth = today.getMonth()
    const curYear  = today.getFullYear()

    return full
      .filter(dateStr => {
        const d = new Date(dateStr)
        return d.getFullYear() === curYear && d.getMonth() === curMonth && d >= today
      })
      .map(dateStr => {
        const d    = new Date(dateStr)
        const day  = String(d.getDate()).padStart(2,'0')
        const mo   = MONTH_SHORT[d.getMonth()]
        const wd   = WEEKDAY_SHORT[d.getDay()]
        const named = (macro?.holidays ?? []).find(h => {
          const parts = h.split(' - ')
          if (!parts[0]) return false
          const [dd, mm, yyyy] = parts[0].split('-')
          return parseInt(dd) === d.getDate() && parseInt(mm) === d.getMonth() + 1 && parseInt(yyyy) === d.getFullYear()
        })
        const name = named ? named.split(' - ').slice(1).join(' - ') : 'Feriado'
        return { dateStr, day, mo, wd, name, date: d }
      })
      .sort((a, b) => a.date - b.date)
  }, [macro])

  const today      = new Date()
  const monthLabel = `${MONTH_NAMES_ES[today.getMonth()]} ${today.getFullYear()}`

  const nextHoliday = useMemo(() => {
    const full = macro?.full_holidays ?? []
    const now  = new Date()
    now.setHours(0,0,0,0)
    return full
      .map(ds => new Date(ds))
      .filter(d => d >= now)
      .sort((a, b) => a - b)[0] ?? null
  }, [macro])

  const daysToNext = nextHoliday
    ? Math.round((nextHoliday - new Date().setHours(0,0,0,0)) / 86_400_000)
    : null

  return (
    <div className="panel-ancho">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

        {/* ── Left: Holiday List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="macro-card">
            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                  🏖️ Feriados — {monthLabel}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Próximos feriados del mes corriente
                </p>
              </div>
              <span style={{
                fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
                background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)',
                borderRadius: 999, padding: '3px 10px', letterSpacing: '0.04em'
              }}>
                {holidays.length === 0 ? 'Ninguno' : `${holidays.length} restante${holidays.length > 1 ? 's' : ''}`}
              </span>
            </div>

            {holidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center" style={{ padding: '40px 0', gap: 12 }}>
                <span style={{ fontSize: 40 }}>✅</span>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center' }}>
                  Sin feriados restantes este mes<br />
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Todos los días son hábiles de ahora en más</span>
                </div>
              </div>
            ) : (
              holidays.map((h, i) => (
                <div key={h.dateStr} className="flex items-start gap-4" style={{
                  padding: '16px 0',
                  borderBottom: i < holidays.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}>
                  {/* Date block */}
                  <div className="flex flex-col items-center" style={{
                    minWidth: 52, background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10, padding: '8px 4px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                      {h.mo}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {h.day}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
                      {h.wd}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {h.name}
                    </div>
                    <div>
                      <span style={{
                        fontWeight: 600, padding: '2px 10px',
                        borderRadius: 999, border: '1px solid var(--border-color)',
                        background: 'var(--bg-card-hover)', color: 'var(--text-muted)',
                        fontSize: 11, letterSpacing: '0.03em'
                      }}>
                        Feriado nacional
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Sidebar widgets ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Countdown */}
          {daysToNext != null && nextHoliday && (
            <div className="macro-card" style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Próximo feriado
              </h3>
              <div style={{ padding: '8px 0 4px' }}>
                {daysToNext === 0 ? (
                  <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px' }}>¡HOY!</div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>faltan</div>
                    <div style={{
                      fontSize: 64, fontWeight: 800, color: 'var(--text-main)',
                      lineHeight: 1, letterSpacing: '-2px'
                    }}>
                      {daysToNext}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, fontWeight: 500 }}>
                      {daysToNext === 1 ? 'día' : 'días'}
                    </div>
                  </>
                )}
                <div style={{
                  marginTop: 20, paddingTop: 16,
                  borderTop: '1px solid var(--border-color)',
                  fontSize: 13, color: 'var(--text-main)', fontWeight: 600
                }}>
                  {nextHoliday.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="macro-card">
            <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Acerca de los feriados
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Solo se muestran los feriados del mes corriente que aún no pasaron. Los fines de semana no se incluyen en la cuenta de días hábiles bancarios.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
