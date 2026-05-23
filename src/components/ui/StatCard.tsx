import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: LucideIcon
  variant?: 'neutral' | 'warning' | 'error' | 'success' | 'danger' | 'info'
  className?: string
}

const variantStyles: Record<NonNullable<StatCardProps['variant']>, string> = {
  neutral: 'border-stone-200 text-stone-500',
  warning: 'border-brand-orange text-brand-orange',
  error: 'border-red-500 text-red-600',
  success: 'border-emerald-500 text-emerald-600',
  danger: 'border-red-500 text-red-600',
  info: 'border-blue-500 text-blue-600'
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  icon: Icon,
  variant = 'neutral',
  className = ''
}) => (
  <div
    className={`border-2 bg-white p-4 ${variantStyles[variant]} ${className}`}
  >
    <div className='mb-2 flex items-start justify-between gap-3'>
      <span className='text-[10px] font-black uppercase tracking-widest text-stone-400'>
        {label}
      </span>
      {Icon && <Icon className='h-4 w-4 shrink-0' />}
    </div>
    <div className='font-mono text-2xl font-black text-brand-charcoal'>
      {value}
    </div>
    {trend && (
      <div
        className={`mt-2 text-[10px] font-bold uppercase ${
          trend.isPositive ? 'text-emerald-600' : 'text-brand-orange'
        }`}
      >
        {trend.isPositive ? '+' : ''}
        {trend.value}% vs last period
      </div>
    )}
  </div>
)

export default StatCard
