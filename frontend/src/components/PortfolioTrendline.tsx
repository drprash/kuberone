import React, { useMemo } from 'react';
import type { PortfolioSummary, PortfolioSnapshot } from '../types';
import { formatAmount } from '../lib/currencies';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface Props {
  summary: PortfolioSummary;
  /** Real daily snapshots for this family (see backend app.snapshot), oldest first. */
  history: PortfolioSnapshot[];
  baseCurrency: string;
  loading?: boolean;
  label?: string;
}

interface SeriesPoint {
  date: string;
  value: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (iso === todayIso()) return 'Today';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Smooth cubic path connecting the given (already real) points — cosmetic only,
 * it doesn't introduce any value between two consecutive real data points. */
function makePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const w = (cx - px) * 0.42;
    d += ` C ${(px + w).toFixed(1)},${py.toFixed(1)} ${(cx - w).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
  }
  return d;
}

export default function PortfolioTrendline({ summary, history, baseCurrency, loading, label }: Props) {
  const isProfit = summary.total_profit_loss >= 0;
  const pct = summary.total_profit_loss_percentage;

  // Real history plus today's live figure (fresher than tonight's not-yet-run snapshot job).
  // If today already has a captured snapshot, the live number replaces it rather than
  // showing two points for the same day.
  const series = useMemo<SeriesPoint[]>(() => {
    const today = todayIso();
    const prior = history.filter((h) => h.date !== today).map((h) => ({ date: h.date, value: h.total_value }));
    return [...prior, { date: today, value: summary.current_value }];
  }, [history, summary.current_value]);

  const hasHistory = series.length >= 2;

  const { linePath, fillPath, endDot } = useMemo(() => {
    if (!hasHistory) return { linePath: '', fillPath: '', endDot: null as [number, number] | null };
    const W = 800;
    const H = 96;
    const padY = 8;
    const values = series.map((p) => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;
    const pts: [number, number][] = series.map((p, i) => [
      (i / (series.length - 1)) * W,
      padY + (1 - (p.value - minV) / range) * (H - padY * 2),
    ]);
    const line = makePath(pts);
    const last = pts[pts.length - 1];
    return {
      linePath: line,
      fillPath: `${line} L ${last[0]},${H} L 0,${H} Z`,
      endDot: last,
    };
  }, [series, hasHistory]);

  const color = isProfit ? '#22c55e' : '#ef4444';
  const gradId = isProfit ? 'trendGradGreen' : 'trendGradRed';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow card-hover mb-6 overflow-hidden slide-in">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-2 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-gray-400 dark:text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {label ?? 'Portfolio Performance'}
          </span>
          {hasHistory && (
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">
              · {formatDateLabel(series[0].date)} – {formatDateLabel(series[series.length - 1].date)}
            </span>
          )}
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
            isProfit
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}
        >
          {isProfit ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {isProfit ? '+' : ''}{pct.toFixed(2)}%
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-0">
        {loading ? (
          <div className="w-full flex items-end gap-1 px-4 pb-1" style={{ height: 64 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gray-100 dark:bg-gray-700 animate-pulse"
                style={{ height: `${30 + Math.sin(i * 0.9) * 15 + Math.cos(i * 1.4) * 10}%` }}
              />
            ))}
          </div>
        ) : !hasHistory ? (
          <div className="flex items-center justify-center text-center px-4" style={{ height: 64 }}>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Building performance history — check back tomorrow for your first trend point.
            </p>
          </div>
        ) : (
          <svg
            viewBox="0 0 800 96"
            preserveAspectRatio="none"
            className="w-full"
            style={{ height: 64 }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              pathLength="1"
              strokeDasharray="1"
              className="trendline-path"
            />
            {endDot && (
              <circle
                cx={endDot[0]}
                cy={endDot[1]}
                r="5"
                fill={color}
                stroke="white"
                strokeWidth="2"
                className="trendline-dot"
              />
            )}
          </svg>
        )}
        {/* Subtle midline */}
        <div
          className="absolute inset-x-4 border-t border-dashed border-gray-100 dark:border-gray-700 pointer-events-none"
          style={{ top: '50%' }}
        />
      </div>

      {/* Footer */}
      <div className="px-4 md:px-6 pb-3 pt-1 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
        <span>{hasHistory ? formatDateLabel(series[0].date) : ''}</span>
        <div className="flex items-center gap-3">
          <span>
            Invested:{' '}
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {formatAmount(summary.total_investment, baseCurrency)}
            </span>
          </span>
          <span
            className={`font-semibold ${
              isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {isProfit ? '+' : ''}{formatAmount(summary.total_profit_loss, baseCurrency)}
          </span>
        </div>
        <span>{hasHistory ? 'Today' : ''}</span>
      </div>
    </div>
  );
}
