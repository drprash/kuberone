import React from 'react';
import type { PortfolioSummary } from '../types';
import { formatAmount } from '../lib/currencies';
import { TrendingUp, TrendingDown, Wallet, PieChart } from 'lucide-react';

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
  baseCurrency: string;
}

export default function PortfolioSummaryComponent({ summary, baseCurrency }: PortfolioSummaryProps) {
  const isProfit = summary.total_profit_loss >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow card-hover">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Investment</p>
            <p className="text-base md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {formatAmount(summary.total_investment, baseCurrency)}
            </p>
          </div>
          <Wallet className="text-blue-500 shrink-0" size={28} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow card-hover">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Value</p>
            <p className="text-base md:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {formatAmount(summary.current_value, baseCurrency)}
            </p>
          </div>
          <PieChart className="text-indigo-500 shrink-0" size={28} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow card-hover">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total P&amp;L</p>
            <p className={`text-base md:text-2xl font-bold truncate ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
              {isProfit ? '+' : ''}{formatAmount(summary.total_profit_loss, baseCurrency)}
            </p>
          </div>
          {isProfit ? (
            <TrendingUp className="text-green-500 shrink-0" size={28} />
          ) : (
            <TrendingDown className="text-red-500 shrink-0" size={28} />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow card-hover">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Return</p>
            <p className={`text-base md:text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
              {isProfit ? '+' : ''}{summary.total_profit_loss_percentage.toFixed(2)}%
            </p>
          </div>
          <div className={`shrink-0 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
            {isProfit ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
          </div>
        </div>
      </div>
    </div>
  );
}
