// Pure EVM logic + problem generators. No React, no DOM.

const randInt = (min, max, step = 1) => {
  const count = Math.floor((max - min) / step) + 1
  return min + Math.floor(Math.random() * count) * step
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// ---- Core formulas ---------------------------------------------------------

export function compute({ BAC, PV, EV, AC }) {
  const SV = EV - PV
  const CV = EV - AC
  const SPI = EV / PV
  const CPI = EV / AC
  const EAC = BAC / CPI
  const ETC = EAC - AC
  const VAC = BAC - EAC
  return { BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC, ETC, VAC }
}

// ---- Scenario generation ---------------------------------------------------

// Build a base scenario whose numbers feel like a real project.
// plannedPct = how far the plan said we should be.
// actualPct  = how far we actually are (EV / BAC).
// costFactor = AC / EV (>1 means over budget).
export function makeScenario(opts = {}) {
  const BAC = opts.BAC ?? randInt(300, 2000, 50) * 1000
  const plannedPct = opts.plannedPct ?? randInt(25, 85, 5) / 100
  const actualPct = clamp(plannedPct + randInt(-25, 20, 5) / 100, 0.05, 0.98)
  const costFactor = randInt(70, 140, 5) / 100

  const PV = BAC * plannedPct
  const EV = BAC * actualPct
  const AC = EV * costFactor

  return { ...compute({ BAC, PV, EV, AC }), plannedPct, actualPct }
}

// ---- Status classification -------------------------------------------------

// Returns one of: 'behind-over' | 'behind-under' | 'ahead-over' | 'ahead-under' | 'on-track'
// "On-track" only when both indices are very close to 1.
export function classify(scenario) {
  const { SPI, CPI } = scenario
  const onSched = Math.abs(SPI - 1) < 0.03
  const onCost = Math.abs(CPI - 1) < 0.03
  if (onSched && onCost) return 'on-track'
  const sched = SPI < 1 ? 'behind' : 'ahead'
  const cost = CPI < 1 ? 'over' : 'under'
  return `${sched}-${cost}`
}

export const STATUS_LABELS = {
  'behind-over': '遅延 + コスト超過',
  'behind-under': '遅延 + コスト節約',
  'ahead-over': '順調/前倒し + コスト超過',
  'ahead-under': '順調/前倒し + コスト節約',
  'on-track': 'オンスケ + オンコスト',
}

// ---- Numeric question definitions ------------------------------------------

export const METRICS = {
  SV:  { label: 'SV',  unit: 'currency', formula: 'EV − PV',     decimals: 0 },
  CV:  { label: 'CV',  unit: 'currency', formula: 'EV − AC',     decimals: 0 },
  SPI: { label: 'SPI', unit: 'ratio',    formula: 'EV ÷ PV',     decimals: 2 },
  CPI: { label: 'CPI', unit: 'ratio',    formula: 'EV ÷ AC',     decimals: 2 },
  EAC: { label: 'EAC', unit: 'currency', formula: 'BAC ÷ CPI',   decimals: 0 },
  ETC: { label: 'ETC', unit: 'currency', formula: 'EAC − AC',    decimals: 0 },
  VAC: { label: 'VAC', unit: 'currency', formula: 'BAC − EAC',   decimals: 0 },
}

// Tolerance: ratio metrics accept ±0.02; currency accepts ±2% with $500 floor.
export function isCorrect(metricId, userValue, truth) {
  if (!Number.isFinite(userValue)) return false
  const meta = METRICS[metricId]
  if (meta.unit === 'ratio') {
    return Math.abs(userValue - truth) <= 0.02
  }
  const absTol = Math.max(500, Math.abs(truth) * 0.02)
  return Math.abs(userValue - truth) <= absTol
}

// ---- Problem builders ------------------------------------------------------

export function buildNumericProblem() {
  const scenario = makeScenario()
  const metricId = pick(['SV', 'CV', 'SPI', 'CPI', 'EAC', 'ETC', 'VAC'])
  return {
    type: 'numeric',
    scenario,
    metricId,
    truth: scenario[metricId],
  }
}

export function buildStatusProblem() {
  // Re-roll until we get a non-on-track scenario for clearer judgments.
  let scenario
  let label
  for (let i = 0; i < 6; i++) {
    scenario = makeScenario()
    label = classify(scenario)
    if (label !== 'on-track') break
  }
  return {
    type: 'status',
    scenario,
    truth: label,
    choices: ['behind-over', 'behind-under', 'ahead-over', 'ahead-under'],
  }
}

// Build a 0..12 month timeline that lands at scenario values at t = "now".
export function buildGraphProblem() {
  let scenario
  let label
  for (let i = 0; i < 6; i++) {
    scenario = makeScenario()
    label = classify(scenario)
    if (label !== 'on-track') break
  }
  const totalMonths = 12
  // Snapshot month is anchored to plannedPct so PV(now) = scenario.PV under linear plan.
  const now = clamp(Math.round(scenario.plannedPct * totalMonths), 2, totalMonths - 1)

  const points = []
  for (let t = 0; t <= totalMonths; t++) {
    const pv = scenario.BAC * (t / totalMonths)
    let ev = null
    let ac = null
    if (t <= now) {
      // Slight S-curve so it doesn't look perfectly linear.
      const f = t / now
      const curve = f * (1.1 - 0.1 * f)
      ev = scenario.EV * curve
      ac = scenario.AC * curve
    }
    points.push({ t, PV: Math.round(pv), EV: ev == null ? null : Math.round(ev), AC: ac == null ? null : Math.round(ac) })
  }
  return {
    type: 'graph',
    scenario,
    truth: label,
    choices: ['behind-over', 'behind-under', 'ahead-over', 'ahead-under'],
    points,
    now,
  }
}

export function buildProblem(mode) {
  if (mode === 'numeric') return buildNumericProblem()
  if (mode === 'status') return buildStatusProblem()
  if (mode === 'graph') return buildGraphProblem()
  // mixed
  const r = Math.random()
  if (r < 0.55) return buildNumericProblem()
  if (r < 0.8) return buildStatusProblem()
  return buildGraphProblem()
}

// ---- Formatting helpers ----------------------------------------------------

export function fmtMoney(n) {
  if (!Number.isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString()}`
}

export function fmtRatio(n) {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

export function fmtMetric(metricId, n) {
  return METRICS[metricId].unit === 'ratio' ? fmtRatio(n) : fmtMoney(n)
}
