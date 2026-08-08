import { useMemo, useState } from 'react'
import type { DateEntry, ExerciseDetail } from './records'
import { extractEntries } from './records'

type Props = {
  content: string
}

type SeriesPoint = { date: string; value: number }

const CHART_WIDTH = 600
const CHART_HEIGHT = 220
const PAD_TOP = 16
const PAD_RIGHT = 12
const PAD_BOTTOM = 32
const PAD_LEFT = 40

function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const base = rawStep / pow
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return nice * pow
}

type Scale = { yMin: number; yMax: number; ticks: number[] }

function niceScale(min: number, max: number, zero: boolean): Scale {
  const lo = zero ? Math.min(0, min) : min
  const hi = max
  if (lo === hi) {
    const step = niceStep(Math.max(Math.abs(hi), 1) * 0.1)
    return { yMin: lo - step, yMax: hi + step, ticks: [lo - step, lo, hi + step] }
  }
  const step = niceStep((hi - lo) / 4)
  const yMin = Math.floor(lo / step) * step
  const yMax = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = yMin; v <= yMax + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6)
  }
  return { yMin, yMax, ticks }
}

function volumeOf(ex: ExerciseDetail): number {
  if (ex.weight == null || ex.reps.length === 0) return 0
  const repSum = ex.reps.reduce((a, b) => a + b, 0)
  return ex.weight * repSum
}

function estimatedOneRM(ex: ExerciseDetail): number {
  if (ex.weight == null || ex.reps.length === 0) return 0
  const maxReps = Math.max(...ex.reps)
  if (maxReps <= 0) return 0
  return ex.weight * (1 + maxReps / 30)
}

function toWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay()
  const diff = (day + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - diff)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

function LineChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) {
    return <EmptyChart message="データがありません" />
  }
  const values = points.map((p) => p.value)
  const { yMin, yMax, ticks: yTicks } = niceScale(Math.min(...values), Math.max(...values), false)
  const innerW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0
  const xOf = (i: number) =>
    points.length > 1 ? PAD_LEFT + stepX * i : PAD_LEFT + innerW / 2
  const yOf = (v: number) =>
    PAD_TOP + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.value)}`)
    .join(' ')

  const xTicks = pickTicks(points.length, 6)

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      role="img"
      className="chart-svg"
    >
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_LEFT}
            x2={CHART_WIDTH - PAD_RIGHT}
            y1={yOf(t)}
            y2={yOf(t)}
            stroke="var(--secondary)"
            strokeDasharray="2 4"
          />
          <text x={PAD_LEFT - 6} y={yOf(t)} textAnchor="end" dominantBaseline="central" fill="var(--muted)" fontSize="10">
            {formatTick(t)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={p.date + i} cx={xOf(i)} cy={yOf(p.value)} r="3" fill="var(--accent)" />
      ))}
      {xTicks.map((i) => (
        <text
          key={i}
          x={xOf(i)}
          y={CHART_HEIGHT - PAD_BOTTOM + 14}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize="10"
        >
          {shortDate(points[i].date)}
        </text>
      ))}
    </svg>
  )
}

function BarChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) {
    return <EmptyChart message="データがありません" />
  }
  const values = points.map((p) => p.value)
  const { yMin, yMax, ticks: yTicks } = niceScale(Math.min(...values), Math.max(...values), false)
  const innerW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
  const bandW = innerW / points.length
  const barW = Math.max(2, bandW * 0.7)
  const yOf = (v: number) =>
    PAD_TOP + innerH - ((v - yMin) / (yMax - yMin)) * innerH
  const yBase = PAD_TOP + innerH
  const xOfCenter = (i: number) => PAD_LEFT + bandW * (i + 0.5)

  const xTicks = pickTicks(points.length, 6)

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      role="img"
      className="chart-svg"
    >
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD_LEFT}
            x2={CHART_WIDTH - PAD_RIGHT}
            y1={yOf(t)}
            y2={yOf(t)}
            stroke="var(--secondary)"
            strokeDasharray="2 4"
          />
          <text x={PAD_LEFT - 6} y={yOf(t)} textAnchor="end" dominantBaseline="central" fill="var(--muted)" fontSize="10">
            {formatTick(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => {
        const y = yOf(p.value)
        const h = Math.max(0, yBase - y)
        return (
          <rect
            key={p.date + i}
            x={xOfCenter(i) - barW / 2}
            y={y}
            width={barW}
            height={h}
            fill="var(--accent)"
            rx="2"
          />
        )
      })}
      {xTicks.map((i) => (
        <text
          key={i}
          x={xOfCenter(i)}
          y={CHART_HEIGHT - PAD_BOTTOM + 14}
          textAnchor="middle"
          fill="var(--muted)"
          fontSize="10"
        >
          {shortDate(points[i].date)}
        </text>
      ))}
    </svg>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      className="chart-svg"
    >
      <text
        x={CHART_WIDTH / 2}
        y={CHART_HEIGHT / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--muted)"
        fontSize="14"
      >
        {message}
      </text>
    </svg>
  )
}

function pickTicks(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const step = Math.ceil(n / max)
  const ticks: number[] = []
  for (let i = 0; i < n; i += step) ticks.push(i)
  if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1)
  return ticks
}

function formatTick(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`
  return String(Math.round(v * 10) / 10)
}

function buildExerciseReps(entries: DateEntry[], name: string): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (const e of entries) {
    const ex = e.exercises.find((x) => x.name === name)
    if (!ex || ex.reps.length === 0) continue
    const total = ex.reps.reduce((a, b) => a + b, 0)
    if (total <= 0) continue
    points.push({ date: e.date, value: total })
  }
  return points
}

function hasNumericWeight(entries: DateEntry[], name: string): boolean {
  return entries.some((e) => {
    const ex = e.exercises.find((x) => x.name === name)
    return !!ex && ex.weight != null
  })
}

function buildExerciseVolume(entries: DateEntry[], name: string): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (const e of entries) {
    const ex = e.exercises.find((x) => x.name === name)
    if (!ex) continue
    const v = volumeOf(ex)
    if (v <= 0) continue
    points.push({ date: e.date, value: v })
  }
  return points
}

function buildExerciseOneRM(entries: DateEntry[], name: string): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (const e of entries) {
    const ex = e.exercises.find((x) => x.name === name)
    if (!ex) continue
    const v = estimatedOneRM(ex)
    if (v <= 0) continue
    points.push({ date: e.date, value: Math.round(v * 10) / 10 })
  }
  return points
}

function buildDailyVolume(entries: DateEntry[]): SeriesPoint[] {
  return entries.map((e) => ({
    date: e.date,
    value: e.exercises.reduce((sum, ex) => sum + volumeOf(ex), 0),
  }))
}

function buildWeeklyVolume(entries: DateEntry[]): SeriesPoint[] {
  const byWeek = new Map<string, number>()
  for (const e of entries) {
    const key = toWeekKey(e.date)
    const v = e.exercises.reduce((sum, ex) => sum + volumeOf(ex), 0)
    byWeek.set(key, (byWeek.get(key) || 0) + v)
  }
  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value }))
}

function uniqueExerciseNames(entries: DateEntry[]): string[] {
  const counts = new Map<string, number>()
  for (const e of entries) {
    for (const ex of e.exercises) {
      counts.set(ex.name, (counts.get(ex.name) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
}

type VolumeMode = 'daily' | 'weekly'

function ExerciseSection({
  name,
  entries,
}: {
  name: string
  entries: DateEntry[]
}) {
  const weighted = useMemo(() => hasNumericWeight(entries, name), [entries, name])
  const oneRM = useMemo(
    () => (weighted ? buildExerciseOneRM(entries, name) : []),
    [entries, name, weighted],
  )
  const volume = useMemo(
    () => (weighted ? buildExerciseVolume(entries, name) : []),
    [entries, name, weighted],
  )
  const reps = useMemo(
    () => (weighted ? [] : buildExerciseReps(entries, name)),
    [entries, name, weighted],
  )

  const latest = weighted
    ? oneRM[oneRM.length - 1]
    : reps[reps.length - 1]
  const latestLabel = weighted ? '最新1RM' : '最新レップ'

  return (
    <section className="exercise-section">
      <h2 className="exercise-heading">
        <span>{name}</span>
        {latest && (
          <span className="exercise-meta">
            {latestLabel} {latest.value}
          </span>
        )}
      </h2>
      {weighted ? (
        <>
          <div className="exercise-chart">
            <div className="chart-label">推定1RM</div>
            <LineChart points={oneRM} />
          </div>
          <div className="exercise-chart">
            <div className="chart-label">ボリューム</div>
            <BarChart points={volume} />
          </div>
        </>
      ) : (
        <div className="exercise-chart">
          <div className="chart-label">総レップ数</div>
          <LineChart points={reps} />
        </div>
      )}
    </section>
  )
}

export function Graph({ content }: Props) {
  const entries = useMemo(() => extractEntries(content), [content])
  const exerciseNames = useMemo(() => uniqueExerciseNames(entries), [entries])
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('daily')

  const totalVolume = useMemo(
    () => (volumeMode === 'daily' ? buildDailyVolume(entries) : buildWeeklyVolume(entries)),
    [entries, volumeMode],
  )

  if (entries.length === 0) {
    return (
      <div className="graph">
        <p className="graph-empty">記録がまだありません。</p>
      </div>
    )
  }

  return (
    <div className="graph">
      <section className="graph-section">
        <div className="graph-section-head">
          <h2>総ボリューム推移</h2>
          <div className="graph-toggle" role="tablist">
            <button
              type="button"
              className={volumeMode === 'daily' ? 'is-active' : ''}
              onClick={() => setVolumeMode('daily')}
            >
              日次
            </button>
            <button
              type="button"
              className={volumeMode === 'weekly' ? 'is-active' : ''}
              onClick={() => setVolumeMode('weekly')}
            >
              週次
            </button>
          </div>
        </div>
        <BarChart points={totalVolume} />
        <p className="graph-note">重量 × 総レップ数の合計</p>
      </section>

      {exerciseNames.map((name) => (
        <ExerciseSection key={name} name={name} entries={entries} />
      ))}
    </div>
  )
}
