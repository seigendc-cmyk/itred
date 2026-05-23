/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  ApprovalRequest,
  FinanceReportFilters,
  FinanceReportResult,
  FinanceReportType
} from '../types.ts'
import { approvalService } from '../services/approvalService.ts'
import { financeService } from '../services/financeService.ts'
import { financeReportService } from '../services/financeReportService.ts'
import { notificationService } from '../services/notificationService.ts'
import { permissionService } from '../services/permissionService.ts'
import { staffAuditService } from '../services/staffAuditService.ts'
import {
  downloadCsv,
  installFinancePrintStyles,
  printFinanceReport
} from '../utils/financePrintUtils.ts'
import {
  getSession,
  getSessionStaffId,
  getSessionStaffName
} from '../utils/session.ts'

const REPORT_TYPES: FinanceReportType[] = [
  'Cash / Bank Ledger Report',
  'Transaction Listing Report',
  'Chart of Accounts Report',
  'Cash / Bank Account Balances Report',
  'Receipts Report',
  'Payments Report',
  'Journal Entries Report',
  'RPN Payments / Commissions Report',
  'Asset Register Report',
  'Asset Maintenance Report',
  'Finance Approval Report',
  'Print / Export Audit Report'
]

const PERIOD_PRESETS: FinanceReportFilters['periodPreset'][] = [
  'Today',
  'This Week',
  'This Month',
  'This Quarter',
  'This Year',
  'Custom'
]

const inputClass =
  'w-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-brand-orange'
const labelClass =
  'text-[10px] font-black uppercase tracking-widest text-stone-400'

const toDateInput = (date: Date) => date.toISOString().slice(0, 10)

const getPresetRange = (preset: FinanceReportFilters['periodPreset']) => {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (preset === 'Today') {
    return { dateFrom: toDateInput(start), dateTo: toDateInput(end) }
  }
  if (preset === 'This Week') {
    start.setDate(now.getDate() - now.getDay())
    return { dateFrom: toDateInput(start), dateTo: toDateInput(end) }
  }
  if (preset === 'This Month') {
    start.setDate(1)
    return { dateFrom: toDateInput(start), dateTo: toDateInput(end) }
  }
  if (preset === 'This Quarter') {
    start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1)
    return { dateFrom: toDateInput(start), dateTo: toDateInput(end) }
  }
  if (preset === 'This Year') {
    start.setMonth(0, 1)
    return { dateFrom: toDateInput(start), dateTo: toDateInput(end) }
  }
  return {}
}

const formatMoney = (value: unknown) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0))

const formatValue = (value: unknown) => {
  if (typeof value === 'number') return formatMoney(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const getColumns = (rows: any[]) => {
  const preferred = [
    'transactionDate',
    'transactionNumber',
    'description',
    'accountCode',
    'accountName',
    'assetCode',
    'assetName',
    'category',
    'status',
    'debit',
    'credit',
    'runningBalance',
    'currentBalance',
    'purchaseCost',
    'currentValue',
    'createdAt'
  ]
  const keys = Array.from<string>(
    rows.reduce((set, row) => {
      Object.keys((row || {}) as Record<string, unknown>).forEach(key => set.add(key))
      return set
    }, new Set<string>())
  )
  return [
    ...preferred.filter(key => keys.includes(key)),
    ...keys.filter(key => !preferred.includes(key)).slice(0, 8)
  ].slice(0, 12)
}

const FinanceReports: React.FC = () => {
  const session = getSession()
  const [filters, setFilters] = useState<FinanceReportFilters>({
    reportType: 'Cash / Bank Ledger Report',
    periodPreset: 'This Month',
    ...getPresetRange('This Month')
  })
  const [report, setReport] = useState<FinanceReportResult | null>(null)
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(
    []
  )
  const [approvalReason, setApprovalReason] = useState('')
  const [message, setMessage] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)

  const chartOfAccounts = useMemo(() => financeService.getChartOfAccounts(), [])
  const cashBankAccounts = useMemo(
    () => financeService.getCashBankAccounts(),
    []
  )
  const assets = useMemo(() => financeService.getAssets(), [])
  const printLogs = useMemo(
    () => financeReportService.getPrintLogs({}),
    [report]
  )

  const canView = permissionService.canViewFinanceReports()
  const canPrint = permissionService.canPrintFinanceReports()
  const canPdf = permissionService.canDownloadFinanceReportPdf()
  const canCsv = permissionService.canExportFinanceReportCsv()
  const canViewSensitive = permissionService.canViewSensitiveFinanceReports()

  const sensitive = financeReportService.isSensitiveReport(filters.reportType)
  const reportApproval = report
    ? approvalRequests.find(
        request =>
          request.requestType === 'finance_report_print' &&
          request.recordId === report.reportRef
      )
    : undefined
  const hasApprovedRequest = reportApproval?.status === 'approved'
  const approvalPending = reportApproval?.status === 'pending'
  const approvalRejected =
    reportApproval?.status === 'rejected' ||
    reportApproval?.status === 'returned_for_correction'

  const canPrintCurrent = report
    ? financeReportService.canPrintReport(report.reportType, {
        canPrint,
        canViewSensitive,
        hasApprovedRequest
      })
    : false
  const canPdfCurrent =
    !!report &&
    canPdf &&
    (!sensitive || canViewSensitive || hasApprovedRequest) &&
    !approvalRejected

  useEffect(() => {
    installFinancePrintStyles()
    approvalService
      .getAll()
      .then(setApprovalRequests)
      .catch(() => setApprovalRequests([]))
  }, [])

  const refreshApprovals = async () => {
    setApprovalRequests(await approvalService.getAll())
  }

  const updateFilter = <K extends keyof FinanceReportFilters>(
    key: K,
    value: FinanceReportFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handlePeriodPreset = (preset: FinanceReportFilters['periodPreset']) => {
    setFilters(prev => ({
      ...prev,
      periodPreset: preset,
      ...getPresetRange(preset)
    }))
  }

  const handlePreview = async () => {
    setMessage('')
    if (!canView) {
      setMessage('You do not have permission to view finance reports.')
      return
    }
    if (sensitive && !canViewSensitive) {
      setMessage(
        'This sensitive report requires additional permission or print approval.'
      )
    }
    const nextReport = await financeReportService.getReportData(
      filters.reportType,
      filters
    )
    setReport(nextReport)
    await refreshApprovals()
  }

  const createAttemptLog = async (
    action: 'print' | 'pdf_download' | 'csv_export',
    status: 'blocked' | 'completed'
  ) => {
    if (!report) return
    try {
      financeReportService.createPrintLog({
        reportRef: report.reportRef,
        reportType: report.reportType,
        filters: report.filters,
        action,
        approvalId: reportApproval?.id,
        status,
        staffId: getSessionStaffId(session),
        staffName: getSessionStaffName(session, 'Unknown staff')
      })
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Report print audit could not be created.'
      )
      if (status === 'completed') return
    }
    void staffAuditService.logAction({
      eventType:
        action === 'print' ? 'REPORT_PRINTED' : 'REPORT_EXPORT_REQUESTED',
      module: 'finance_reports',
      severity: 'high',
      action:
        action === 'print'
          ? `Printed finance report ${report.reportType}`
          : `Exported finance report ${report.reportType}`,
      recordType: 'finance_report',
      recordId: report.reportRef,
      recordName: report.reportType,
      afterSnapshot: { action, status, filters: report.filters }
    })
    if (status === 'completed') {
      await notificationService.createNotification({
        title:
          action === 'print'
            ? 'Sensitive Finance Report Printed'
            : 'Finance Report Exported',
        message: `${getSessionStaffName(session, 'Unknown staff')} ${
          action === 'print' ? 'printed' : 'exported'
        } ${report.reportType}.`,
        type: 'finance_report',
        priority: financeReportService.isSensitiveReport(report.reportType)
          ? 'high'
          : 'medium',
        recordType: 'finance_report',
        recordId: report.reportRef,
        targetRole: 'Admin',
        createdByStaffId: getSessionStaffId(session),
        createdByName: getSessionStaffName(session, 'Unknown staff'),
        dedupeKey: `finance-report-${action}:${report.reportRef}:${Date.now()}`
      })
    }
  }

  const handlePrint = async () => {
    if (!report) return
    if (!canPrintCurrent || approvalPending || approvalRejected) {
      setMessage('You do not have permission to print finance reports.')
      await createAttemptLog('print', 'blocked')
      return
    }
    await createAttemptLog('print', 'completed')
    printFinanceReport()
  }

  const handlePdf = async () => {
    if (!report) return
    if (!canPdfCurrent || approvalPending || approvalRejected) {
      setMessage('You do not have permission to download PDF finance reports.')
      await createAttemptLog('pdf_download', 'blocked')
      return
    }
    await createAttemptLog('pdf_download', 'completed')
    printFinanceReport()
  }

  const handleCsv = async () => {
    if (!report) return
    if (!canCsv) {
      setMessage('You do not have permission to export finance reports.')
      await createAttemptLog('csv_export', 'blocked')
      return
    }
    await createAttemptLog('csv_export', 'completed')
    downloadCsv(`${report.reportRef}.csv`, report.rows)
  }

  const handleRequestApproval = async () => {
    if (!report) {
      setMessage('Preview the report before requesting approval.')
      return
    }
    const approvalId = await financeReportService.requestReportApproval({
      reportType: report.reportType,
      reportRef: report.reportRef,
      filters: report.filters,
      reason: approvalReason || 'Sensitive finance report print/export request.'
    })
    setMessage(`Print approval requested. Approval Ref: ${approvalId}`)
    await refreshApprovals()
  }

  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const dashboard = {
    reportsToday: printLogs.filter(log => log.createdAt.startsWith(today))
      .length,
    printsToday: printLogs.filter(
      log => log.action === 'print' && log.createdAt.startsWith(today)
    ).length,
    pdfToday: printLogs.filter(
      log => log.action === 'pdf_download' && log.createdAt.startsWith(today)
    ).length,
    pendingApprovals: approvalRequests.filter(
      request =>
        request.requestType === 'finance_report_print' &&
        request.status === 'pending'
    ).length,
    sensitiveMonth: printLogs.filter(
      log =>
        log.createdAt.startsWith(thisMonth) &&
        financeReportService.isSensitiveReport(log.reportType)
    ).length,
    mostPrinted:
      Object.entries(
        printLogs.reduce<Record<string, number>>((acc, log) => {
          acc[log.reportType] = (acc[log.reportType] || 0) + 1
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No print activity',
    lastPrintedBy: printLogs[0]?.staffName || 'No print activity'
  }

  const columns = report ? getColumns(report.rows) : []

  if (!canView) {
    return (
      <div className='p-6'>
        <div className='bg-white border border-red-200 p-6 text-sm font-bold text-red-700'>
          You do not have permission to view finance reports.
        </div>
      </div>
    )
  }

  return (
    <div className='p-4 md:p-6 space-y-6'>
      <section className='bg-white border border-stone-200 p-5 md:p-6 shadow-sm no-print'>
        <p className='text-xs font-black uppercase tracking-widest text-brand-orange'>
          SCI / iTred Finance & Accounts
        </p>
        <h1 className='text-2xl font-black text-brand-charcoal mt-2'>
          Finance Reports
        </h1>
        <p className='text-sm text-stone-600 mt-3 max-w-4xl'>
          Filter, preview, print and export finance reports with staff identity,
          approvals, notifications and audit logs.
        </p>
      </section>

      {message && (
        <div className='no-print border-l-4 border-brand-orange bg-orange-50 p-4 text-xs font-bold uppercase tracking-wide text-orange-800'>
          {message}
        </div>
      )}

      <section className='no-print grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4'>
        {[
          ['Reports Today', dashboard.reportsToday],
          ['Prints Today', dashboard.printsToday],
          ['PDF Downloads Today', dashboard.pdfToday],
          ['Pending Approvals', dashboard.pendingApprovals],
          ['Sensitive This Month', dashboard.sensitiveMonth],
          ['Most Printed', dashboard.mostPrinted],
          ['Last Printed By', dashboard.lastPrintedBy]
        ].map(([label, value]) => (
          <div key={label} className='bg-white border-2 border-stone-200 p-4'>
            <p className='text-[10px] font-black uppercase tracking-widest text-stone-400'>
              {label}
            </p>
            <p className='text-xl font-black text-brand-charcoal mt-3 truncate'>
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className='no-print bg-white border border-stone-200'>
        <button
          type='button'
          onClick={() => setFiltersOpen(prev => !prev)}
          className='w-full px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-brand-charcoal border-b border-stone-200'
        >
          Universal Report Filters
        </button>
        {filtersOpen && (
          <div className='p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3'>
            <label className='space-y-1 xl:col-span-2'>
              <span className={labelClass}>Report Type</span>
              <select
                value={filters.reportType}
                onChange={event =>
                  updateFilter(
                    'reportType',
                    event.target.value as FinanceReportType
                  )
                }
                className={inputClass}
              >
                {REPORT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Period Preset</span>
              <select
                value={filters.periodPreset || 'Custom'}
                onChange={event =>
                  handlePeriodPreset(
                    event.target.value as FinanceReportFilters['periodPreset']
                  )
                }
                className={inputClass}
              >
                {PERIOD_PRESETS.map(preset => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Status</span>
              <input
                value={filters.status || ''}
                onChange={event => updateFilter('status', event.target.value)}
                className={inputClass}
                placeholder='posted / active / pending'
              />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Date From</span>
              <input
                type='date'
                value={filters.dateFrom || ''}
                onChange={event => updateFilter('dateFrom', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Date To</span>
              <input
                type='date'
                value={filters.dateTo || ''}
                onChange={event => updateFilter('dateTo', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Account</span>
              <select
                value={filters.accountId || ''}
                onChange={event =>
                  updateFilter('accountId', event.target.value)
                }
                className={inputClass}
              >
                <option value=''>All accounts</option>
                {chartOfAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.accountCode} - {account.accountName}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Cash/Bank Account</span>
              <select
                value={filters.cashBankAccountId || ''}
                onChange={event =>
                  updateFilter('cashBankAccountId', event.target.value)
                }
                className={inputClass}
              >
                <option value=''>All cash/bank</option>
                {cashBankAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Transaction / Account Type</span>
              <input
                value={filters.transactionType || ''}
                onChange={event =>
                  updateFilter('transactionType', event.target.value)
                }
                className={inputClass}
                placeholder='Deposit / Asset / Expense'
              />
            </label>
            {[
              ['Staff', 'staff'],
              ['Vendor', 'vendor'],
              ['RPN', 'rpn'],
              ['Payee / Payer', 'payeePayer'],
              ['Approval Status', 'approvalStatus']
            ].map(([label, key]) => (
              <label key={key} className='space-y-1'>
                <span className={labelClass}>{label}</span>
                <input
                  value={String(
                    filters[key as keyof FinanceReportFilters] || ''
                  )}
                  onChange={event =>
                    updateFilter(
                      key as keyof FinanceReportFilters,
                      event.target.value as never
                    )
                  }
                  className={inputClass}
                />
              </label>
            ))}
            <label className='space-y-1'>
              <span className={labelClass}>Asset Category</span>
              <select
                value={filters.assetCategory || ''}
                onChange={event =>
                  updateFilter('assetCategory', event.target.value)
                }
                className={inputClass}
              >
                <option value=''>All categories</option>
                {Array.from(new Set(assets.map(asset => asset.category))).map(
                  category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Asset Status</span>
              <input
                value={filters.assetStatus || ''}
                onChange={event =>
                  updateFilter('assetStatus', event.target.value)
                }
                className={inputClass}
              />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Amount Min</span>
              <input
                type='number'
                value={filters.amountMin ?? ''}
                onChange={event =>
                  updateFilter(
                    'amountMin',
                    event.target.value === ''
                      ? undefined
                      : Number(event.target.value)
                  )
                }
                className={inputClass}
              />
            </label>
            <label className='space-y-1'>
              <span className={labelClass}>Amount Max</span>
              <input
                type='number'
                value={filters.amountMax ?? ''}
                onChange={event =>
                  updateFilter(
                    'amountMax',
                    event.target.value === ''
                      ? undefined
                      : Number(event.target.value)
                  )
                }
                className={inputClass}
              />
            </label>
          </div>
        )}
      </section>

      <section className='no-print bg-white border border-stone-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center'>
        <button
          type='button'
          onClick={handlePreview}
          className='bg-brand-charcoal px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white'
        >
          Preview Report
        </button>
        <input
          value={approvalReason}
          onChange={event => setApprovalReason(event.target.value)}
          className={`${inputClass} lg:max-w-sm`}
          placeholder='Approval reason for sensitive report'
        />
        <button
          type='button'
          disabled={
            !report || !sensitive || approvalPending || hasApprovedRequest
          }
          onClick={handleRequestApproval}
          className='border border-brand-orange px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-orange disabled:opacity-40'
        >
          Request Print Approval
        </button>
        <button
          type='button'
          disabled={
            !report || !canPrintCurrent || approvalPending || approvalRejected
          }
          onClick={handlePrint}
          className='border border-stone-300 px-4 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-40'
        >
          Print Locally
        </button>
        <button
          type='button'
          disabled={
            !report || !canPdfCurrent || approvalPending || approvalRejected
          }
          onClick={handlePdf}
          className='border border-stone-300 px-4 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-40'
        >
          Print / Save as PDF
        </button>
        <button
          type='button'
          disabled={!report || !canCsv}
          onClick={handleCsv}
          className='border border-stone-300 px-4 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-40'
        >
          Export CSV
        </button>
      </section>

      {!canPrint && (
        <p className='no-print text-xs font-bold text-red-700'>
          You do not have permission to print finance reports.
        </p>
      )}

      <section
        id='finance-report-print-area'
        className='bg-white border border-stone-200 p-6'
      >
        {report ? (
          <div className='space-y-6'>
            <header className='border-b-2 border-brand-charcoal pb-4'>
              <p className='text-xs font-black uppercase tracking-widest text-brand-orange'>
                SCI Operating System
              </p>
              <h2 className='text-2xl font-black text-brand-charcoal mt-1'>
                {report.title}
              </h2>
              <p className='text-xs font-bold text-stone-500 mt-1'>
                Powered by seiGEN Commerce / iTred Finance & Accounts
              </p>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs'>
                <p>
                  Period: {report.filters.dateFrom || '-'} to{' '}
                  {report.filters.dateTo || '-'}
                </p>
                <p>
                  Generated By: {getSessionStaffName(session, 'Unknown staff')}
                </p>
                <p>Staff Desk: {session?.desk || 'Unassigned desk'}</p>
                <p>
                  Printed On: {new Date(report.generatedAt).toLocaleString()}
                </p>
                <p>Report Reference: {report.reportRef}</p>
                <p>
                  Approval Status:{' '}
                  {reportApproval?.status ||
                    (sensitive ? 'Required' : 'Not required')}
                </p>
                {reportApproval?.reviewedByName && (
                  <p>Approved By: {reportApproval.reviewedByName}</p>
                )}
                {reportApproval?.id && <p>Approval Ref: {reportApproval.id}</p>}
              </div>
            </header>

            <div className='text-xs border border-stone-200 p-3'>
              <strong>Filters:</strong>{' '}
              {financeReportService.formatFiltersSummary(report.filters) ||
                'None'}
            </div>

            {report.unavailableMessage && (
              <div className='border-l-4 border-brand-orange bg-orange-50 p-4 text-xs font-bold text-orange-800'>
                {report.unavailableMessage}
              </div>
            )}

            {report.rows.length === 0 ? (
              <div className='p-10 text-center text-sm font-bold text-stone-400 border border-dashed border-stone-200'>
                No records found for the selected filters.
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='w-full text-left text-[11px] border-collapse'>
                  <thead className='bg-stone-50 text-[9px] uppercase tracking-widest text-stone-500'>
                    <tr>
                      {columns.map(column => (
                        <th
                          key={column}
                          className='border border-stone-200 px-2 py-2'
                        >
                          {column.replace(/([A-Z])/g, ' $1')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr key={row.id || index}>
                        {columns.map(column => (
                          <td
                            key={column}
                            className='border border-stone-100 px-2 py-2 align-top'
                          >
                            {formatValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <section className='grid grid-cols-1 md:grid-cols-4 gap-3'>
              {Object.entries(report.totals).map(([key, value]) => (
                <div key={key} className='border border-stone-200 p-3'>
                  <p className='text-[9px] font-black uppercase tracking-widest text-stone-400'>
                    {key}
                  </p>
                  <p className='text-lg font-black text-brand-charcoal mt-1'>
                    {typeof value === 'number' ? formatMoney(value) : value}
                  </p>
                </div>
              ))}
            </section>

            <footer className='border-t border-stone-200 pt-4 text-[10px] font-bold text-stone-500'>
              This report was generated from the SCI / iTred Finance & Accounts
              module. Unauthorized printing or distribution is prohibited.
            </footer>
          </div>
        ) : (
          <div className='p-10 text-center text-sm font-bold text-stone-400'>
            Preview a report to see print-ready output.
          </div>
        )}
      </section>
    </div>
  )
}

export default FinanceReports
