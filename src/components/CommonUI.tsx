/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import {
  LucideIcon,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  size = "md",
  className = "",
  ...props
}) => (
  <button
    className={`btn-primary ${size === "sm" ? "px-3 py-1.5 text-[9px]" : ""} ${className}`}
    {...props}
  >
    {children}
  </button>
);

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  size = "md",
  className = "",
  ...props
}) => (
  <button
    className={`btn-secondary ${size === "sm" ? "px-3 py-1.5 text-[9px]" : ""} ${className}`}
    {...props}
  >
    {children}
  </button>
);

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: LucideIcon;
  variant?: "neutral" | "warning" | "error" | "success" | "danger";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  icon: Icon,
  variant = "neutral",
}) => {
  const borderColors = {
    neutral: "border-stone-200",
    warning: "border-brand-orange",
    error: "border-red-500",
    success: "border-green-500",
    danger: "border-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card flex flex-col justify-between border-2 ${borderColors[variant]}`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] uppercase font-bold text-gray-400">
          {label}
        </span>
        {Icon && (
          <Icon
            className={`w-4 h-4 ${variant === "neutral" ? "text-stone-300" : variant === "warning" ? "text-brand-orange" : variant === "success" ? "text-green-500" : "text-red-500"}`}
          />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-bold font-mono text-brand-charcoal">
          {value}
        </span>
        {trend && (
          <span
            className={`flex items-center text-[10px] mt-2 ${trend.isPositive ? "text-green-600" : "text-brand-orange"}`}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}% vs last month
          </span>
        )}
      </div>
    </motion.div>
  );
};

interface DataPanelProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  title,
  children,
  actions,
  subtitle,
  className = "",
}) => (
  <div className={`card h-full flex flex-col p-0 overflow-hidden ${className}`}>
    <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
      <div className="flex flex-col">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-charcoal">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[9px] text-gray-400 font-mono mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
    <div className="flex-1 overflow-auto">{children}</div>
  </div>
);

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
}) => (
  <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
    <div className="hidden">
      {" "}
      {/* We use titles in AppShell header now as per the theme */}
      <h1 className="text-xl font-bold uppercase tracking-tight text-brand-charcoal">
        {title}
      </h1>
      {subtitle && (
        <p className="text-xs text-stone-400 uppercase tracking-widest mt-1">
          {subtitle}
        </p>
      )}
    </div>
    <div className="flex-1" />
    <div className="flex gap-2">{actions}</div>
  </header>
);

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-stone-200">
    {Icon && <Icon className="w-12 h-12 text-stone-300 mb-4" />}
    <h3 className="text-lg font-bold uppercase tracking-wide mb-2">{title}</h3>
    <p className="text-stone-500 max-w-xs mb-6 text-sm">{description}</p>
    {action}
  </div>
);

export const StatusBadge: React.FC<{
  status: string;
  variant?: "success" | "warning" | "error" | "info" | "neutral";
}> = ({ status, variant = "neutral" }) => {
  const styles = {
    success: "bg-green-50 text-green-700 border-green-100",
    warning: "bg-orange-50 text-brand-orange border-orange-100",
    error: "bg-red-50 text-red-700 border-red-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
    neutral: "bg-stone-50 text-stone-600 border-stone-200",
  };

  return (
    <span
      className={`px-2 py-0.5 text-[9px] uppercase font-bold border ${styles[variant]}`}
    >
      {status}
    </span>
  );
};

export const SearchInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className = "", ...props }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
    <input
      className="w-full bg-stone-50 border border-stone-200 pl-9 pr-4 py-1.5 text-xs font-bold focus:outline-none focus:border-brand-orange transition-colors"
      {...props}
    />
  </div>
);

export const FormSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="space-y-4">
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-orange border-b border-orange-100 pb-2 mb-4">
      {title}
    </h4>
    <div className="space-y-4">{children}</div>
  </div>
);

export const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, children, required }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] uppercase font-bold text-stone-400">
      {label} {required && <span className="text-brand-orange">*</span>}
    </label>
    {children}
  </div>
);

interface TablePanelProps extends DataPanelProps {
  headers: (string | React.ReactNode)[];
}

export const TablePanel: React.FC<TablePanelProps> = ({
  headers,
  children,
  ...props
}) => (
  <DataPanel {...props}>
    <div className="overflow-x-auto min-h-[200px]">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
          <tr className="text-[9px] uppercase font-bold text-stone-400">
            {headers.map((h, i) => (
              <th key={i} className="px-6 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  </DataPanel>
);

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info" | "success";
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = "seiGEN Commerce",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "info",
  children,
}) => {
  if (!isOpen) return null;

  const confirmClass =
    variant === "danger" || variant === "warning"
      ? "bg-red-700 hover:bg-red-800 border-red-800"
      : "bg-brand-orange hover:bg-orange-600 border-orange-600";
  const iconClass =
    variant === "danger" || variant === "warning"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-orange-50 text-brand-orange border-orange-100";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-sm w-full border-t-4 border-brand-orange shadow-2xl overflow-hidden rounded-none"
      >
        <div className="bg-brand-charcoal px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-tight text-white">
            {title || "seiGEN Commerce"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-6 bg-white">
          <div className="flex items-start gap-4">
            <div className={`p-2 shrink-0 border ${iconClass}`}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm text-stone-700 leading-relaxed">
                {message}
              </p>
              {children && <div className="mt-4">{children}</div>}
            </div>
          </div>
        </div>
        <div className="bg-stone-50 p-4 flex justify-end gap-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-stone-200 text-[10px] uppercase font-bold text-stone-600 hover:bg-stone-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 border text-[10px] uppercase font-bold text-white shadow-sm transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export const ActivityTimeline: React.FC<{
  items: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    details: any;
  }>;
}> = ({ items }) => (
  <div className="space-y-6">
    {items.map((item, i) => (
      <div
        key={item.id}
        className="relative pl-6 pb-6 last:pb-0 border-l border-stone-100"
      >
        <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 bg-brand-orange rounded-full border-2 border-white" />
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-bold uppercase tracking-tight text-stone-700">
            {(item.eventType || "SYSTEM EVENT").replace(/_/g, " ")}
          </h4>
          <span className="text-[9px] font-mono text-stone-400">
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-[10px] text-stone-400 mt-1 leading-relaxed line-clamp-2">
          {typeof item.details === "string"
            ? item.details
            : JSON.stringify(item.details)}
        </p>
      </div>
    ))}
    {items.length === 0 && (
      <div className="text-center py-10">
        <Clock className="w-8 h-8 text-stone-200 mx-auto mb-2" />
        <p className="text-[10px] uppercase font-bold text-stone-300">
          No recent activity detected.
        </p>
      </div>
    )}
  </div>
);

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Terminal Runtime Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-10 text-center border-2 border-red-500 bg-red-50">
            <h2 className="text-xl font-bold uppercase text-red-700">
              Runtime Exception Detected
            </h2>
            <p className="text-xs text-red-500 mt-2 font-bold font-mono">
              Module execution halted at current terminal session.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-red-700 text-white text-[10px] uppercase font-bold"
            >
              Re-Initialize Terminal
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export interface BrandedAlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

export const BrandedAlertModal: React.FC<BrandedAlertModalProps> = ({
  isOpen,
  title = "seiGEN Commerce",
  message,
  type = "success",
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-brand-charcoal/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-sm w-full border-t-4 border-brand-orange shadow-2xl overflow-hidden rounded-none"
      >
        <div className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-tight text-brand-charcoal mb-2">
            {title}
          </h3>
          <p className="text-sm text-stone-600 leading-relaxed">{message}</p>
        </div>
        <div className="bg-stone-50 p-4 flex justify-end border-t border-stone-100">
          <PrimaryButton onClick={onClose} className="px-6 py-2 text-xs">
            OK
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
};
