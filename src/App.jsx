import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  buildProblem, isCorrect, METRICS, STATUS_LABELS,
  fmtMoney, fmtRatio, fmtMetric,
} from './evm.js'

const STORAGE_KEY = 'evm-trainer/stats/v1'

const MODES = [
  { id: 'mixed',   label: 'ミックス' },
  { id: 'numeric', label: '数値' },
  { id: 'status',  label: '状況' },
  { id: 'graph',   label: 'グラフ' },
]

const emptyStats = () => ({
  total: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  byKey: {}, // { 'numeric:CPI': { total, correct }, 'status': { total, correct }, ... }
})

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStats()
    const parsed = JSON.parse(raw)
    return { ...emptyStats(), ...parsed, byKey: parsed.byKey ?? {} }
  } catch {
    return emptyStats()
  }
}

function saveStats(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

function statKeyFor(problem) {
  if (problem.type === 'numeric') return `numeric:${problem.metricId}`
  return problem.type
}

export default function App() {
  const [mode, setMode] = useState('mixed')
  const [problem, setProblem] = useState(() => buildProblem('mixed'))
  const [phase, setPhase] = useState('answering') // 'answering' | 'feedback'
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState(null)
  const [lastCorrect, setLastCorrect] = useState(null)
  const [stats, setStats] = useState(loadStats)
  const inputRef = useRef(null)

  useEffect(() => { saveStats(stats) }, [stats])

  // Auto-focus the numeric input when a new question appears.
  useEffect(() => {
    if (phase === 'answering' && problem.type === 'numeric') {
      inputRef.current?.focus()
    }
  }, [phase, problem])

  function nextProblem(forMode = mode) {
    setProblem(buildProblem(forMode))
    setPhase('answering')
    setInput('')
    setPicked(null)
    setLastCorrect(null)
  }

  function changeMode(next) {
    setMode(next)
    setProblem(buildProblem(next))
    setPhase('answering')
    setInput('')
    setPicked(null)
    setLastCorrect(null)
  }

  function recordResult(correct) {
    setStats((s) => {
      const key = statKeyFor(problem)
      const prev = s.byKey[key] ?? { total: 0, correct: 0 }
      const streak = correct ? s.streak + 1 : 0
      return {
        total: s.total + 1,
        correct: s.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        byKey: {
          ...s.byKey,
          [key]: { total: prev.total + 1, correct: prev.correct + (correct ? 1 : 0) },
        },
      }
    })
  }

  function submitNumeric() {
    if (input.trim() === '') return
    const v = Number(input)
    const ok = isCorrect(problem.metricId, v, problem.truth)
    setLastCorrect(ok)
    recordResult(ok)
    setPhase('feedback')
  }

  function submitChoice(choice) {
    setPicked(choice)
    const ok = choice === problem.truth
    setLastCorrect(ok)
    recordResult(ok)
    setPhase('feedback')
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      if (phase === 'feedback') { nextProblem(); return }
      if (problem.type === 'numeric') { submitNumeric(); return }
    }
    if (phase === 'answering' && (problem.type === 'status' || problem.type === 'graph')) {
      const idx = ['1','2','3','4'].indexOf(e.key)
      if (idx >= 0) submitChoice(problem.choices[idx])
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, problem, input])

  function resetStats() {
    if (!confirm('成績をリセットしますか？')) return
    setStats(emptyStats())
  }

  const accuracy = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100)

  return (
    <div className="min-h-full flex flex-col">
      <Header
        mode={mode}
        onChangeMode={changeMode}
        stats={stats}
        accuracy={accuracy}
        onReset={resetStats}
      />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pb-10">
        <ProblemCard
          problem={problem}
          phase={phase}
          input={input}
          setInput={setInput}
          picked={picked}
          lastCorrect={lastCorrect}
          inputRef={inputRef}
          onSubmitNumeric={submitNumeric}
          onPickChoice={submitChoice}
          onNext={() => nextProblem()}
        />

        <Breakdown stats={stats} />
      </main>

      <Footer />
    </div>
  )
}

// ---------- Sub-components --------------------------------------------------

function Header({ mode, onChangeMode, stats, accuracy, onReset }) {
  return (
    <header className="border-b border-slate-700/50 bg-slate-900/40 backdrop-blur sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="text-lg font-bold tracking-wide">
          <span className="text-cyan-400">EVM</span> Trainer
        </div>
        <div className="flex gap-1 ml-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeMode(m.id)}
              className={
                'px-3 py-1.5 rounded-md text-sm transition ' +
                (mode === m.id
                  ? 'bg-cyan-500 text-slate-900 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
              }
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Stat label="問題" value={stats.total} />
          <Stat label="正答率" value={`${accuracy}%`} />
          <Stat label="連続" value={stats.streak} />
          <Stat label="最長" value={stats.bestStreak} />
          <button
            onClick={onReset}
            className="ml-2 text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
          >
            リセット
          </button>
        </div>
      </div>
    </header>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function ProblemCard({
  problem, phase, input, setInput, picked, lastCorrect,
  inputRef, onSubmitNumeric, onPickChoice, onNext,
}) {
  return (
    <section className="mt-6 rounded-xl bg-slate-800/60 border border-slate-700/50 p-6 shadow-lg">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-3">
        {problem.type === 'numeric' && '数値問題'}
        {problem.type === 'status' && '状況判断'}
        {problem.type === 'graph' && 'グラフ判断'}
      </div>

      {problem.type === 'numeric' && (
        <NumericBody
          problem={problem}
          phase={phase}
          input={input}
          setInput={setInput}
          inputRef={inputRef}
          onSubmit={onSubmitNumeric}
          lastCorrect={lastCorrect}
        />
      )}

      {(problem.type === 'status' || problem.type === 'graph') && (
        <ChoiceBody
          problem={problem}
          phase={phase}
          picked={picked}
          onPick={onPickChoice}
          lastCorrect={lastCorrect}
        />
      )}

      {phase === 'feedback' && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 font-semibold hover:bg-cyan-400"
          >
            次へ (Enter)
          </button>
        </div>
      )}
    </section>
  )
}

function NumericBody({ problem, phase, input, setInput, inputRef, onSubmit, lastCorrect }) {
  const meta = METRICS[problem.metricId]
  const { scenario } = problem
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Given label="BAC" value={fmtMoney(scenario.BAC)} />
        <Given label="PV"  value={fmtMoney(scenario.PV)} />
        <Given label="EV"  value={fmtMoney(scenario.EV)} />
        <Given label="AC"  value={fmtMoney(scenario.AC)} />
      </div>

      <div className="text-2xl sm:text-3xl font-bold mb-4">
        <span className="text-cyan-400">{meta.label}</span> = ?
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          step="any"
          inputMode="decimal"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={phase === 'feedback'}
          placeholder={meta.unit === 'ratio' ? '例: 0.85' : '例: 120000'}
          className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-lg font-mono outline-none focus:border-cyan-400 disabled:opacity-60"
        />
        {phase === 'answering' && (
          <button
            onClick={onSubmit}
            className="px-4 py-2 rounded-md bg-cyan-500 text-slate-900 font-semibold hover:bg-cyan-400"
          >
            判定 (Enter)
          </button>
        )}
      </div>

      {phase === 'feedback' && (
        <Feedback ok={lastCorrect}>
          <div className="text-sm">
            正解: <span className="font-mono font-semibold">{fmtMetric(problem.metricId, problem.truth)}</span>
            <span className="ml-3 text-slate-400">式: {meta.formula}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {explainNumeric(problem)}
          </div>
        </Feedback>
      )}
    </div>
  )
}

function ChoiceBody({ problem, phase, picked, onPick, lastCorrect }) {
  return (
    <div>
      {problem.type === 'graph'
        ? <GraphPanel problem={problem} />
        : <ScenarioPanel scenario={problem.scenario} />
      }

      <div className="text-lg font-semibold mt-4 mb-3">このプロジェクトの状況は？</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {problem.choices.map((c, i) => {
          const isPicked = picked === c
          const isTruth = problem.truth === c
          const showAns = phase === 'feedback'
          let cls = 'bg-slate-900 border-slate-600 hover:bg-slate-700'
          if (showAns && isTruth) cls = 'bg-emerald-700/40 border-emerald-400'
          else if (showAns && isPicked && !isTruth) cls = 'bg-rose-700/40 border-rose-400'
          return (
            <button
              key={c}
              onClick={() => phase === 'answering' && onPick(c)}
              disabled={phase === 'feedback'}
              className={`text-left px-4 py-3 rounded-md border transition ${cls}`}
            >
              <span className="text-cyan-400 font-mono mr-2">{i + 1}.</span>
              {STATUS_LABELS[c]}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-slate-500 mt-2">数字キー 1〜4 で選択</div>

      {phase === 'feedback' && (
        <Feedback ok={lastCorrect}>
          <div className="text-sm">
            正解: <span className="font-semibold">{STATUS_LABELS[problem.truth]}</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            SPI = {fmtRatio(problem.scenario.SPI)} ／ CPI = {fmtRatio(problem.scenario.CPI)}
            {'　'}SPI &lt; 1 → 遅延、CPI &lt; 1 → 超過
          </div>
        </Feedback>
      )}
    </div>
  )
}

function ScenarioPanel({ scenario }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Given label="BAC" value={fmtMoney(scenario.BAC)} />
      <Given label="PV"  value={fmtMoney(scenario.PV)} />
      <Given label="EV"  value={fmtMoney(scenario.EV)} />
      <Given label="AC"  value={fmtMoney(scenario.AC)} />
    </div>
  )
}

function GraphPanel({ problem }) {
  const data = problem.points
  return (
    <div>
      <div className="h-64 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              stroke="#94a3b8"
              label={{ value: '月', position: 'insideBottom', offset: -2, fill: '#94a3b8' }}
            />
            <YAxis
              stroke="#94a3b8"
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              width={55}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
              formatter={(v) => fmtMoney(v)}
              labelFormatter={(t) => `t = ${t}`}
            />
            <Legend />
            <ReferenceLine x={problem.now} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'now', fill: '#f59e0b', position: 'top' }} />
            <Line type="monotone" dataKey="PV" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="EV" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="AC" stroke="#f472b6" strokeWidth={2} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-xs text-slate-400 mt-1">
        現在 t = {problem.now}: PV = {fmtMoney(problem.scenario.PV)}, EV = {fmtMoney(problem.scenario.EV)}, AC = {fmtMoney(problem.scenario.AC)}
      </div>
    </div>
  )
}

function Given({ label, value }) {
  return (
    <div className="bg-slate-900/60 rounded-md px-3 py-2 border border-slate-700/40">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-mono font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Feedback({ ok, children }) {
  return (
    <div
      className={
        'mt-4 rounded-md px-4 py-3 border ' +
        (ok
          ? 'bg-emerald-900/30 border-emerald-500/40'
          : 'bg-rose-900/30 border-rose-500/40')
      }
    >
      <div className={'font-bold mb-1 ' + (ok ? 'text-emerald-300' : 'text-rose-300')}>
        {ok ? '⭕ 正解' : '❌ 不正解'}
      </div>
      {children}
    </div>
  )
}

function Breakdown({ stats }) {
  const entries = Object.entries(stats.byKey)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1].total - a[1].total)
  return (
    <section className="mt-6 rounded-xl bg-slate-800/40 border border-slate-700/40 p-4">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">カテゴリ別</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {entries.map(([key, v]) => {
          const acc = Math.round((v.correct / v.total) * 100)
          const weak = acc < 70
          return (
            <div
              key={key}
              className={
                'rounded-md px-3 py-2 border flex justify-between items-baseline ' +
                (weak ? 'bg-rose-900/20 border-rose-500/30' : 'bg-slate-900/40 border-slate-700/40')
              }
            >
              <span className="font-mono">{prettyKey(key)}</span>
              <span className="text-slate-300 tabular-nums">
                {v.correct}/{v.total} <span className="text-slate-500 ml-1">{acc}%</span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function prettyKey(key) {
  if (key.startsWith('numeric:')) return key.split(':')[1]
  if (key === 'status') return '状況判断'
  if (key === 'graph') return 'グラフ'
  return key
}

function Footer() {
  return (
    <footer className="text-center text-xs text-slate-500 py-4">
      Enter=回答/次へ・1〜4=選択肢・成績はこの端末のブラウザに保存されます
    </footer>
  )
}

// ---- Explanation builder ---------------------------------------------------

function explainNumeric(problem) {
  const s = problem.scenario
  const m = problem.metricId
  switch (m) {
    case 'SV':  return `EV − PV = ${fmtMoney(s.EV)} − ${fmtMoney(s.PV)} = ${fmtMoney(s.SV)}`
    case 'CV':  return `EV − AC = ${fmtMoney(s.EV)} − ${fmtMoney(s.AC)} = ${fmtMoney(s.CV)}`
    case 'SPI': return `EV ÷ PV = ${fmtMoney(s.EV)} ÷ ${fmtMoney(s.PV)} = ${fmtRatio(s.SPI)}`
    case 'CPI': return `EV ÷ AC = ${fmtMoney(s.EV)} ÷ ${fmtMoney(s.AC)} = ${fmtRatio(s.CPI)}`
    case 'EAC': return `BAC ÷ CPI = ${fmtMoney(s.BAC)} ÷ ${fmtRatio(s.CPI)} = ${fmtMoney(s.EAC)}`
    case 'ETC': return `EAC − AC = ${fmtMoney(s.EAC)} − ${fmtMoney(s.AC)} = ${fmtMoney(s.ETC)}`
    case 'VAC': return `BAC − EAC = ${fmtMoney(s.BAC)} − ${fmtMoney(s.EAC)} = ${fmtMoney(s.VAC)}`
    default: return ''
  }
}
