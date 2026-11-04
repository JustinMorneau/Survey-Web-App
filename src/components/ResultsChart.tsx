import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { QuestionResult } from '../lib/results'

const BAR_COLOR = '#1e5b4a'
const ROW_HEIGHT = 52

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/**
 * Horizontal bar chart for one question. Every bar shows its count and
 * percentage as text (UI.md §9). The chart is hidden from screen readers;
 * the table below carries the same numbers.
 */
export default function ResultsChart({ question }: { question: QuestionResult }) {
  const data = question.choices.map((choice) => ({
    label: choice.choice_text,
    count: choice.count,
    valueLabel: `${choice.count}  ${formatPercent(choice.percentage)}`,
  }))

  return (
    <div>
      <div aria-hidden="true" className="w-full" style={{ height: data.length * ROW_HEIGHT + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 96, bottom: 8, left: 8 }}
          >
            <XAxis type="number" hide domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#1f2a37', fontSize: 15 }}
            />
            <Bar dataKey="count" fill={BAR_COLOR} barSize={26} isAnimationActive={false}>
              <LabelList
                dataKey="valueLabel"
                position="right"
                style={{ fill: '#1f2a37', fontSize: 15, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Results for {question.question_text}</caption>
        <thead>
          <tr>
            <th scope="col">Choice</th>
            <th scope="col">Count</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {question.choices.map((choice) => (
            <tr key={choice.choice_id}>
              <th scope="row">{choice.choice_text}</th>
              <td>{choice.count}</td>
              <td>{formatPercent(choice.percentage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
