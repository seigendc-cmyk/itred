/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'
import {
  collection,
  query,
  getDocs,
  addDoc,
  serverTimestamp,
  where
} from 'firebase/firestore'
// @ts-ignore - Adjust this import to match your project's Firebase config location
import { db } from '../../firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  FileText,
  BrainCircuit,
  Download,
  Save,
  Search,
  AlertTriangle,
  Activity,
  MapPin,
  Package,
  ShieldAlert,
  Users,
  TrendingDown,
  Clock,
  CheckCircle
} from 'lucide-react'
import { vendorMarketFeedBIService } from '../../services/vendorMarketFeedBIService'
import {
  VendorMarketFeedReport,
  WhatsAppActivityLog,
  WhatsAppIntelligenceLog
} from '../../types'
import { GoogleGenAI } from '@google/genai'
import { sanitizeForFirestore } from '../../utils/firestoreSanitize.ts'

const COLORS = [
  '#f97316',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#f59e0b',
  '#10b981'
]

const ScoreCard = ({ title, value, subtitle, icon: Icon, alert }: any) => (
  <div
    className={`bg-white border-2 p-4 rounded-none flex flex-col justify-between ${
      alert ? 'border-red-500 bg-red-50' : 'border-stone-200'
    }`}
  >
    <div className='flex justify-between items-start mb-2'>
      <h3
        className={`text-[10px] font-black uppercase tracking-widest ${
          alert ? 'text-red-600' : 'text-brand-orange'
        }`}
      >
        {title}
      </h3>
      {Icon && (
        <Icon size={16} className={alert ? 'text-red-500' : 'text-stone-400'} />
      )}
    </div>
    <div>
      <div
        className={`text-2xl md:text-3xl font-black ${
          alert ? 'text-red-700' : 'text-brand-charcoal'
        }`}
      >
        {value}
      </div>
      {subtitle && (
        <div className='text-[10px] md:text-xs font-bold text-stone-500 uppercase mt-1 tracking-wider'>
          {subtitle}
        </div>
      )}
    </div>
  </div>
)

type ExtendedReport = VendorMarketFeedReport & {
  sectorBenchmark?: {
    enabled: boolean
    benchmarkScope: string
    sector: string | null
    city: string | null
    suburb: string | null
    comparableVendorCount: number
    minimumRequired: number
    hasEnoughData: boolean
    metrics: any[]
  }
}

export const VendorMarketActivityReport: React.FC = () => {
  const [vendors, setVendors] = useState<
    {
      id: string
      name: string
      sector: string
      cityTown: string
      suburb: string
    }[]
  >([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Sector Benchmark Options
  const [enableBenchmark, setEnableBenchmark] = useState(false)
  const [benchmarkScope, setBenchmarkScope] = useState('sector')
  const [minComparable, setMinComparable] = useState(3)

  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [reportData, setReportData] = useState<ExtendedReport | null>(null)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiInterpretation, setAiInterpretation] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const snap = await getDocs(collection(db, 'vendors'))
        const vList = snap.docs.map(d => ({
          id: d.id,
          name: d.data().businessName || d.data().name || 'Unknown Vendor',
          sector: d.data().sector || d.data().businessSector || '',
          cityTown: d.data().cityTown || d.data().city || '',
          suburb: d.data().suburb || ''
        }))
        setVendors(vList.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        console.error('Failed to fetch vendors:', error)
      }
    }
    fetchVendors()
  }, [])

  const generateMetrics = async () => {
    if (!selectedVendorId) {
      alert('Please select a vendor first.')
      return
    }
    setLoadingMetrics(true)
    setAiInterpretation('') // Reset previous AI text
    setReportData(null)

    try {
      let activityQuery = query(
        collection(db, 'whatsapp_activity_logs'),
        where('vendorId', '==', selectedVendorId)
      )
      if (dateFrom)
        activityQuery = query(activityQuery, where('createdAt', '>=', dateFrom))
      if (dateTo)
        activityQuery = query(
          activityQuery,
          where('createdAt', '<=', dateTo + 'T23:59:59')
        )

      const activitySnap = await getDocs(activityQuery)
      const activityLogs = activitySnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as WhatsAppActivityLog[]

      let intelQuery = query(
        collection(db, 'whatsapp_intelligence_logs'),
        where('vendorId', '==', selectedVendorId)
      )
      if (dateFrom)
        intelQuery = query(intelQuery, where('createdAt', '>=', dateFrom))
      if (dateTo)
        intelQuery = query(
          intelQuery,
          where('createdAt', '<=', dateTo + 'T23:59:59')
        )

      const intelSnap = await getDocs(intelQuery)
      const intelLogs = intelSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as WhatsAppIntelligenceLog[]

      const selectedVendor = vendors.find(v => v.id === selectedVendorId)
      const selectedVendorName = selectedVendor?.name || 'Unknown Vendor'

      const report = vendorMarketFeedBIService.generateReport(
        activityLogs,
        intelLogs,
        {
          vendorId: selectedVendorId,
          vendorName: selectedVendorName,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        }
      ) as ExtendedReport

      let sectorBenchmark = {
        enabled: enableBenchmark,
        benchmarkScope,
        sector: selectedVendor?.sector || null,
        city: selectedVendor?.cityTown || null,
        suburb: selectedVendor?.suburb || null,
        comparableVendorCount: 0,
        minimumRequired: minComparable,
        hasEnoughData: false,
        metrics: [] as any[]
      }

      if (enableBenchmark && selectedVendor) {
        let comp = vendors.filter(
          v =>
            v.id !== selectedVendorId &&
            v.sector &&
            v.sector === selectedVendor.sector
        )
        if (benchmarkScope === 'city' || benchmarkScope === 'suburb') {
          comp = comp.filter(
            v => v.cityTown && v.cityTown === selectedVendor.cityTown
          )
        }
        if (benchmarkScope === 'suburb') {
          comp = comp.filter(
            v => v.suburb && v.suburb === selectedVendor.suburb
          )
        }

        const compIds = comp.map(v => v.id)
        sectorBenchmark.comparableVendorCount = compIds.length

        if (compIds.length >= minComparable) {
          sectorBenchmark.hasEnoughData = true

          const chunkArray = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
              arr.slice(i * size, i * size + size)
            )
          const chunks = chunkArray(compIds, 10)

          let allCompActLogs: WhatsAppActivityLog[] = []
          let allCompIntLogs: WhatsAppIntelligenceLog[] = []

          for (const chunk of chunks) {
            let actQ = query(
              collection(db, 'whatsapp_activity_logs'),
              where('vendorId', 'in', chunk)
            )
            if (dateFrom) actQ = query(actQ, where('createdAt', '>=', dateFrom))
            if (dateTo)
              actQ = query(actQ, where('createdAt', '<=', dateTo + 'T23:59:59'))
            const actS = await getDocs(actQ)
            allCompActLogs.push(
              ...actS.docs.map(
                d => ({ id: d.id, ...d.data() } as WhatsAppActivityLog)
              )
            )

            let intQ = query(
              collection(db, 'whatsapp_intelligence_logs'),
              where('vendorId', 'in', chunk)
            )
            if (dateFrom) intQ = query(intQ, where('createdAt', '>=', dateFrom))
            if (dateTo)
              intQ = query(intQ, where('createdAt', '<=', dateTo + 'T23:59:59'))
            const intS = await getDocs(intQ)
            allCompIntLogs.push(
              ...intS.docs.map(
                d => ({ id: d.id, ...d.data() } as WhatsAppIntelligenceLog)
              )
            )
          }

          let sumMetrics = {
            totalInteractions: 0,
            score: 0,
            productEnquiries: 0,
            convertedLeads: 0,
            lostLeads: 0,
            averageResponseTimeMinutes: 0
          }

          for (const vId of compIds) {
            const vAct = allCompActLogs.filter(l => l.vendorId === vId)
            const vInt = allCompIntLogs.filter(l => l.vendorId === vId)
            const vRpt = vendorMarketFeedBIService.generateReport(vAct, vInt, {
              vendorId: vId
            })
            sumMetrics.totalInteractions += vRpt.totalInteractions
            sumMetrics.score += vRpt.score.value
            sumMetrics.productEnquiries += vRpt.productEnquiries
            sumMetrics.convertedLeads += vRpt.convertedLeads
            sumMetrics.lostLeads += vRpt.lostLeads
            sumMetrics.averageResponseTimeMinutes +=
              vRpt.averageResponseTimeMinutes
          }

          const n = compIds.length
          const calcMetric = (
            key: string,
            label: string,
            vendorVal: number,
            sumVal: number,
            inverseGood = false
          ) => {
            const avg = sumVal / n
            const diff = vendorVal - avg
            const diffPct =
              avg === 0 ? (vendorVal > 0 ? 100 : 0) : (diff / avg) * 100

            const status =
              diff === 0
                ? 'Average'
                : diff > 0
                ? 'Higher than Average'
                : 'Lower than Average'
            const isGood = diff === 0 ? null : inverseGood ? diff < 0 : diff > 0

            return {
              key,
              label,
              vendorValue: vendorVal,
              sectorAverage: Math.round(avg * 10) / 10,
              difference: Math.round(diff * 10) / 10,
              differencePercent: Math.round(diffPct * 10) / 10,
              status,
              isGood,
              interpretation: `Vendor is ${Math.abs(Math.round(diffPct))}% ${
                isGood ? 'better' : 'worse'
              } compared to sector average.`
            }
          }

          sectorBenchmark.metrics = [
            calcMetric(
              'totalInteractions',
              'Total Interactions',
              report.totalInteractions,
              sumMetrics.totalInteractions
            ),
            calcMetric(
              'score',
              'Market Feed Score',
              report.score.value,
              sumMetrics.score
            ),
            calcMetric(
              'productEnquiries',
              'Product Enquiries',
              report.productEnquiries,
              sumMetrics.productEnquiries
            ),
            calcMetric(
              'convertedLeads',
              'Converted Leads',
              report.convertedLeads,
              sumMetrics.convertedLeads
            ),
            calcMetric(
              'lostLeads',
              'Lost Leads',
              report.lostLeads,
              sumMetrics.lostLeads,
              true
            ),
            calcMetric(
              'averageResponseTimeMinutes',
              'Avg Response Time (min)',
              report.averageResponseTimeMinutes,
              sumMetrics.averageResponseTimeMinutes,
              true
            )
          ]
        }
      }

      report.sectorBenchmark = sectorBenchmark
      setReportData(report)
    } catch (error) {
      console.error('Error generating metrics:', error)
      alert('An error occurred while generating metrics.')
    } finally {
      setLoadingMetrics(false)
    }
  }

  const generateAIInterpretation = async () => {
    if (!selectedVendorId || !dateFrom || !dateTo) {
      alert('Vendor, Date From, and Date To must be selected.')
      return
    }

    if (!reportData || !reportData.score) {
      alert('Please generate metrics first. Scorecards must exist.')
      return
    }

    if (reportData.totalInteractions === 0) {
      setAiInterpretation(
        'Not enough activity data for this vendor in the selected period.'
      )
      return
    }

    const vendorReportJson = reportData
    console.log('Vendor report JSON sent to Gemini:', vendorReportJson)

    setAiLoading(true)
    try {
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || ''
      })

      const prompt = `You are the SCI iTred Vendor Market Analyst.

Generate a detailed vendor market activity report from the structured data below.

Rules:
- Do not invent numbers.
- Only use numbers provided in the data.
- If a metric is zero or missing, say so clearly.
- Write in professional business language that a Zimbabwean SME vendor can understand.
- Focus on practical sales improvement, catalogue visibility, WhatsApp enquiry handling, product demand, location behaviour, and next action.
- Do not expose confidential competitor names.
- Use sector average only if provided.
- If sectorBenchmark.hasEnoughData is true, you MUST include a 'Sector Benchmark Comparison' section.
- Do not invent numbers. Only use provided benchmark metrics.
- Do not mention names of other vendors.
- If benchmark data is not enough (hasEnoughData is false), state clearly: "Not enough comparable vendor data is available for a reliable sector benchmark."

Report sections:
1. Executive Summary
2. Vendor Market Visibility
3. Product Performance
4. Customer Location Behaviour
5. Search Demand and Missed Opportunities
6. WhatsApp Enquiry Performance
7. Catalogue Cycle Performance
8. Risks Detected
9. Opportunities Detected
10. Recommended Action Plan
11. Sector Benchmark Comparison (If benchmark data is present)

DATA:
${JSON.stringify(vendorReportJson, null, 2)}`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      })

      setAiInterpretation(response.text || 'AI generated an empty response.')
    } catch (error) {
      console.error('AI Generation Error:', error)
      setAiInterpretation(
        'Failed to generate AI interpretation. Check API connection and credentials.'
      )
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveReport = async () => {
    if (!reportData) return
    setSaveLoading(true)
    const cleanData = sanitizeForFirestore(
      JSON.parse(JSON.stringify(reportData))
    )
    try {
      await addDoc(
        collection(db, 'ai_report_outputs'),
        sanitizeForFirestore({
          reportType: 'VendorMarketActivityReport',
          vendorId: selectedVendorId,
          vendorName: reportData.vendorName,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          sourceData: cleanData,
          aiText: aiInterpretation || null,
          createdAt: serverTimestamp(),
          beforeSnapshot: null,
          afterSnapshot: null,
          overrideReason: null,
          notes: null,
          reason: null,
          generatedBy: null
        })
      )
      alert('Report successfully saved to ai_report_outputs.')
    } catch (err) {
      console.error('Error saving report:', err)
      alert('Failed to save report.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (!reportData) return
    const doc = new jsPDF()

    doc.setFontSize(22)
    doc.setTextColor(30, 41, 59) // brand-charcoal approximate
    doc.text('Vendor Market Activity Report', 14, 22)

    doc.setFontSize(11)
    doc.setTextColor(100, 116, 139) // stone-500 approximate
    doc.text(`Vendor: ${reportData.vendorName}`, 14, 32)
    doc.text(
      `Reporting Period: ${dateFrom || 'All Time'} to ${dateTo || 'All Time'}`,
      14,
      38
    )
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 44)

    autoTable(doc, {
      startY: 52,
      head: [['Key Metric', 'Recorded Value']],
      body: [
        ['Total Market Interactions', reportData.totalInteractions.toString()],
        ['Unique Customers Reached', reportData.uniqueCustomers.toString()],
        [
          'Overall Market Feed Score',
          `${reportData.score.value}/100 (Grade ${reportData.score.grade})`
        ],
        ['Product Enquiries', reportData.productEnquiries.toString()],
        ['Price / Quotation Requests', reportData.priceEnquiries.toString()],
        [
          'Stock Availability Queries',
          reportData.stockAvailabilityEnquiries.toString()
        ],
        ['Successfully Converted Leads', reportData.convertedLeads.toString()],
        ['Missed / Lost Leads', reportData.lostLeads.toString()],
        ['Pending WhatsApp Follow-ups', reportData.pendingFollowUps.toString()],
        ['Customer Complaints', reportData.complaints.toString()],
        [
          'Average Response Time',
          `${reportData.averageResponseTimeMinutes} minutes`
        ]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: 255,
        fontStyle: 'bold'
      }, // brand-orange
      styles: { fontSize: 10, cellPadding: 5 }
    })

    let finalY = (doc as any).lastAutoTable.finalY || 52

    if (reportData.sectorBenchmark?.enabled) {
      finalY += 15
      if (finalY > 260) {
        doc.addPage()
        finalY = 20
      }
      doc.setFontSize(14)
      doc.setTextColor(249, 115, 22)
      doc.text('Sector Benchmark Comparison', 14, finalY)

      if (reportData.sectorBenchmark.hasEnoughData) {
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Metric', 'Vendor', 'Sector Avg', 'Difference', 'Status']],
          body: reportData.sectorBenchmark.metrics.map(m => [
            m.label,
            m.vendorValue.toString(),
            m.sectorAverage.toFixed(1),
            `${m.difference > 0 ? '+' : ''}${m.difference.toFixed(
              1
            )} (${m.differencePercent.toFixed(1)}%)`,
            m.status
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: 255,
            fontStyle: 'bold'
          },
          styles: { fontSize: 10, cellPadding: 5 }
        })
        finalY = (doc as any).lastAutoTable.finalY
      } else {
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text(
          'Not enough comparable vendor data is available for a reliable sector benchmark.',
          14,
          finalY + 8
        )
        finalY += 15
      }
    }

    if (aiInterpretation) {
      finalY += 15
      if (finalY > 230) {
        doc.addPage()
        finalY = 20
      } else {
        finalY += 15
      }

      doc.setFontSize(14)
      doc.setTextColor(249, 115, 22)
      doc.text('AI Strategic Interpretation', 14, finalY)

      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      const splitText = doc.splitTextToSize(aiInterpretation, 180)
      doc.text(splitText, 14, finalY + 8)
    }

    doc.save(
      `SCI_VendorReport_${reportData.vendorName.replace(/\s+/g, '_')}.pdf`
    )
  }

  const activityDistribution = reportData
    ? [
        { name: 'Product Enquiries', value: reportData.productEnquiries },
        { name: 'Price Requests', value: reportData.priceEnquiries },
        { name: 'Stock Queries', value: reportData.stockAvailabilityEnquiries },
        { name: 'Converted', value: reportData.convertedLeads },
        { name: 'Lost Leads', value: reportData.lostLeads }
      ].filter(d => d.value > 0)
    : []

  return (
    <div className='min-h-screen bg-stone-50 p-4 md:p-6 pb-20'>
      {/* Header */}
      <div className='bg-white border-2 border-brand-charcoal p-6 mb-6 shadow-sm rounded-none'>
        <div className='flex items-center gap-3 mb-2'>
          <FileText size={24} className='text-brand-orange' />
          <h1 className='text-2xl font-black uppercase tracking-tight text-brand-charcoal'>
            Vendor Market Activity Report
          </h1>
        </div>
        <p className='text-sm text-stone-600 font-medium'>
          Generate AI-interpreted performance metrics based on WhatsApp activity
          and catalogue interactions.
        </p>
      </div>

      {/* Filters */}
      <div className='bg-white border-2 border-stone-200 p-6 mb-6 shadow-sm rounded-none grid grid-cols-1 md:grid-cols-4 gap-4 items-end'>
        <div>
          <label className='block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2'>
            Select Vendor
          </label>
          <select
            className='w-full border-2 border-stone-200 bg-stone-50 p-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange'
            value={selectedVendorId}
            onChange={e => setSelectedVendorId(e.target.value)}
          >
            <option value=''>-- Choose Vendor --</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className='block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2'>
            Date From
          </label>
          <input
            type='date'
            className='w-full border-2 border-stone-200 bg-stone-50 p-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange'
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className='block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2'>
            Date To
          </label>
          <input
            type='date'
            className='w-full border-2 border-stone-200 bg-stone-50 p-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange'
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <button
            onClick={generateMetrics}
            disabled={loadingMetrics || !selectedVendorId}
            className='w-full bg-brand-charcoal text-white font-black uppercase tracking-widest text-xs p-4 hover:bg-brand-orange transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
          >
            {loadingMetrics ? (
              'Calculating...'
            ) : (
              <>
                <Search size={16} /> Generate Metrics
              </>
            )}
          </button>
        </div>
      </div>

      {/* Benchmark Controls */}
      <div className='bg-white border-2 border-stone-200 p-6 mb-6 shadow-sm rounded-none'>
        <label className='flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-charcoal mb-4 cursor-pointer w-max'>
          <input
            type='checkbox'
            checked={enableBenchmark}
            onChange={e => setEnableBenchmark(e.target.checked)}
            className='w-4 h-4 accent-brand-orange'
          />
          Compare to sector average
        </label>
        {enableBenchmark && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
            <div>
              <label className='block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2'>
                Benchmark Scope
              </label>
              <select
                className='w-full border-2 border-stone-200 bg-stone-50 p-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange'
                value={benchmarkScope}
                onChange={e => setBenchmarkScope(e.target.value)}
              >
                <option value='sector'>Same Sector Only</option>
                <option value='city'>Same Sector + Same City</option>
                <option value='suburb'>Same Sector + Same Suburb</option>
              </select>
            </div>
            <div>
              <label className='block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2'>
                Minimum Comparable Vendors
              </label>
              <input
                type='number'
                className='w-full border-2 border-stone-200 bg-stone-50 p-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange'
                value={minComparable}
                onChange={e => setMinComparable(parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
          </div>
        )}
      </div>

      {/* Report Dashboard */}
      {reportData && (
        <div className='space-y-6'>
          {/* Executive & Score */}
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-4'>
            <div className='lg:col-span-1 bg-brand-charcoal text-white border-2 border-brand-charcoal p-6 rounded-none flex flex-col justify-center items-center text-center'>
              <h3 className='text-xs font-black uppercase tracking-widest text-brand-orange mb-2'>
                Market Feed Score
              </h3>
              <div className='text-6xl font-black mb-2'>
                {reportData.score.value}
              </div>
              <div className='text-sm font-bold uppercase tracking-widest text-stone-300'>
                Grade {reportData.score.grade}
              </div>
            </div>
            <div className='lg:col-span-3 bg-white border-2 border-stone-200 p-6 rounded-none flex flex-col justify-center'>
              <h3 className='text-xs font-black uppercase tracking-widest text-brand-orange mb-3'>
                Executive Summary
              </h3>
              <p className='text-sm text-stone-700 leading-relaxed font-medium'>
                {reportData.executiveSummary}
              </p>
            </div>
          </div>

          {/* Scorecards */}
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
            <ScoreCard
              title='Interactions'
              value={reportData.totalInteractions}
              subtitle='Total Hits'
              icon={Activity}
            />
            <ScoreCard
              title='Customers'
              value={reportData.uniqueCustomers}
              subtitle={`${reportData.repeatCustomerCount} Repeat`}
              icon={Users}
            />
            <ScoreCard
              title='Converted'
              value={reportData.convertedLeads}
              subtitle='Successful Deals'
              icon={CheckCircle}
            />
            <ScoreCard
              title='Lost Leads'
              value={reportData.lostLeads}
              subtitle='Missed Sales'
              icon={TrendingDown}
              alert={reportData.lostLeads > 3}
            />
            <ScoreCard
              title='Pending'
              value={reportData.pendingFollowUps}
              subtitle='Needs Action'
              icon={Clock}
              alert={reportData.pendingFollowUps > 5}
            />
            <ScoreCard
              title='Complaints'
              value={reportData.complaints}
              subtitle='Service Issues'
              icon={ShieldAlert}
              alert={reportData.complaints > 0}
            />
          </div>

          {/* Charts Row */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* Top Products Chart */}
            <div className='bg-white border-2 border-stone-200 p-6 rounded-none'>
              <h3 className='text-xs font-black uppercase tracking-widest text-brand-charcoal mb-6 flex items-center gap-2'>
                <Package size={14} className='text-brand-orange' /> Product
                Demand
              </h3>
              {reportData.topRequestedProducts.length > 0 ? (
                <ResponsiveContainer width='100%' height={250}>
                  <BarChart data={reportData.topRequestedProducts.slice(0, 5)}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      vertical={false}
                      stroke='#e5e7eb'
                    />
                    <XAxis
                      dataKey='name'
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: '#f5f5f4' }}
                      contentStyle={{
                        borderRadius: 0,
                        border: '2px solid #1c1917',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    />
                    <Bar
                      dataKey='count'
                      fill='#f97316'
                      radius={[2, 2, 0, 0]}
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className='h-[250px] flex items-center justify-center bg-stone-50 border-2 border-dashed border-stone-200 text-xs font-bold uppercase text-stone-400'>
                  Not enough data
                </div>
              )}
            </div>

            {/* Interaction Types Chart */}
            <div className='bg-white border-2 border-stone-200 p-6 rounded-none'>
              <h3 className='text-xs font-black uppercase tracking-widest text-brand-charcoal mb-6 flex items-center gap-2'>
                <Activity size={14} className='text-brand-orange' /> Activity
                Distribution
              </h3>
              {activityDistribution.length > 0 ? (
                <ResponsiveContainer width='100%' height={250}>
                  <PieChart>
                    <Pie
                      data={activityDistribution}
                      cx='50%'
                      cy='50%'
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey='value'
                    >
                      {activityDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 0,
                        border: '2px solid #1c1917',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className='h-[250px] flex items-center justify-center bg-stone-50 border-2 border-dashed border-stone-200 text-xs font-bold uppercase text-stone-400'>
                  Not enough data
                </div>
              )}
            </div>
          </div>

          {/* Location Behaviour List */}
          <div className='bg-white border-2 border-stone-200 p-6 rounded-none'>
            <h3 className='text-xs font-black uppercase tracking-widest text-brand-charcoal mb-4 flex items-center gap-2'>
              <MapPin size={14} className='text-brand-orange' /> Customer
              Location Behaviour
            </h3>
            {reportData.topCustomerLocations.length > 0 ? (
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {reportData.topCustomerLocations.map((loc, idx) => (
                  <div
                    key={idx}
                    className='bg-stone-50 border border-stone-200 p-3 flex justify-between items-center'
                  >
                    <span className='text-sm font-bold text-brand-charcoal truncate pr-2'>
                      {loc.name}
                    </span>
                    <span className='text-xs font-black text-white bg-brand-charcoal px-2 py-0.5'>
                      {loc.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-xs font-bold uppercase text-stone-400'>
                Not enough data to determine location behaviour.
              </div>
            )}
          </div>

          {/* Sector Benchmark Comparison */}
          {reportData.sectorBenchmark?.enabled && (
            <div className='bg-white border-2 border-stone-200 p-6 rounded-none mt-6'>
              <h3 className='text-xs font-black uppercase tracking-widest text-brand-charcoal mb-4 flex items-center gap-2'>
                <Activity size={14} className='text-brand-orange' /> Sector
                Benchmark Comparison
              </h3>
              {reportData.sectorBenchmark.hasEnoughData ? (
                <div className='overflow-x-auto'>
                  <table className='w-full text-left text-sm border-collapse'>
                    <thead>
                      <tr className='bg-stone-50 border-b border-stone-200 text-[10px] font-black uppercase tracking-widest text-stone-500'>
                        <th className='px-4 py-3'>Metric</th>
                        <th className='px-4 py-3'>Vendor</th>
                        <th className='px-4 py-3'>Sector Avg</th>
                        <th className='px-4 py-3'>Difference</th>
                        <th className='px-4 py-3'>Status</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-stone-100 text-stone-600 font-medium text-xs'>
                      {reportData.sectorBenchmark.metrics.map(m => (
                        <tr key={m.key} className='hover:bg-stone-50'>
                          <td className='px-4 py-3 font-bold text-brand-charcoal uppercase'>
                            {m.label}
                          </td>
                          <td className='px-4 py-3 font-mono'>
                            {m.vendorValue}
                          </td>
                          <td className='px-4 py-3 font-mono'>
                            {m.sectorAverage.toFixed(1)}
                          </td>
                          <td className='px-4 py-3 font-mono'>
                            <span
                              className={
                                m.isGood === true
                                  ? 'text-emerald-600'
                                  : m.isGood === false
                                  ? 'text-red-600'
                                  : ''
                              }
                            >
                              {m.difference > 0 ? '+' : ''}
                              {m.difference.toFixed(1)} (
                              {m.differencePercent.toFixed(1)}%)
                            </span>
                          </td>
                          <td className='px-4 py-3'>
                            <span
                              className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest border ${
                                m.isGood === true
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : m.isGood === false
                                  ? 'bg-red-50 border-red-200 text-red-700'
                                  : 'bg-stone-100 border-stone-200 text-stone-600'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className='mt-4 p-3 bg-stone-50 border border-stone-200 text-[10px] font-bold text-stone-500 uppercase tracking-widest'>
                    Compared against{' '}
                    {reportData.sectorBenchmark.comparableVendorCount} vendors
                    in{' '}
                    {reportData.sectorBenchmark.benchmarkScope === 'sector'
                      ? 'the same sector'
                      : reportData.sectorBenchmark.benchmarkScope === 'city'
                      ? 'the same city'
                      : 'the same suburb'}
                    .
                  </div>
                </div>
              ) : (
                <div className='text-xs font-bold uppercase text-stone-400 p-4 border border-dashed border-stone-200 text-center'>
                  Not enough comparable vendor data is available for a reliable
                  sector benchmark.
                </div>
              )}
            </div>
          )}

          {/* AI Controls */}
          <div className='bg-brand-charcoal p-6 rounded-none border-2 border-brand-charcoal flex flex-col md:flex-row justify-between items-center gap-4'>
            <div className='text-white'>
              <h3 className='text-sm font-black uppercase tracking-widest mb-1'>
                Generate AI Interpretation
              </h3>
              <p className='text-xs text-stone-400'>
                Let Gemini analyze these metrics to build a vendor action plan.
              </p>
            </div>
            <div className='flex flex-wrap gap-3 w-full md:w-auto'>
              <button
                onClick={generateAIInterpretation}
                disabled={aiLoading}
                className='flex-1 md:flex-none bg-brand-orange text-white font-black uppercase tracking-widest text-[10px] px-6 py-3 hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
              >
                {aiLoading ? (
                  'Thinking...'
                ) : (
                  <>
                    <BrainCircuit size={14} /> Analyze Data
                  </>
                )}
              </button>

              {aiInterpretation && (
                <>
                  <button
                    onClick={handleExportPDF}
                    className='flex-1 md:flex-none bg-white text-brand-charcoal font-black uppercase tracking-widest text-[10px] px-6 py-3 hover:bg-stone-100 transition-colors flex items-center justify-center gap-2'
                  >
                    <Download size={14} /> Export PDF
                  </button>
                  <button
                    onClick={handleSaveReport}
                    disabled={saveLoading}
                    className='flex-1 md:flex-none border-2 border-white text-white font-black uppercase tracking-widest text-[10px] px-6 py-3 hover:bg-white hover:text-brand-charcoal transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                  >
                    {saveLoading ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save size={14} /> Save Report
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* AI Output Render */}
          {aiInterpretation && (
            <div className='bg-white border-2 border-brand-orange p-6 md:p-8 rounded-none shadow-lg'>
              <div className='flex items-center gap-2 mb-6 border-b-2 border-stone-100 pb-4'>
                <BrainCircuit size={20} className='text-brand-orange' />
                <h2 className='text-lg font-black uppercase tracking-tight text-brand-charcoal'>
                  AI Strategic Interpretation
                </h2>
              </div>
              <div className='prose prose-sm md:prose-base prose-stone max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-brand-orange'>
                {/* Basic rendering of AI text, respecting line breaks */}
                {aiInterpretation.split('\n').map((paragraph, idx) => {
                  if (paragraph.trim().startsWith('# ')) {
                    return (
                      <h1 key={idx} className='text-xl font-black mt-6 mb-3'>
                        {paragraph.replace('# ', '')}
                      </h1>
                    )
                  }
                  if (paragraph.trim().startsWith('## ')) {
                    return (
                      <h2 key={idx} className='text-lg font-black mt-5 mb-2'>
                        {paragraph.replace('## ', '')}
                      </h2>
                    )
                  }
                  if (paragraph.trim().startsWith('### ')) {
                    return (
                      <h3 key={idx} className='text-md font-bold mt-4 mb-2'>
                        {paragraph.replace('### ', '')}
                      </h3>
                    )
                  }
                  if (
                    paragraph.trim().startsWith('- ') ||
                    paragraph.trim().startsWith('* ')
                  ) {
                    return (
                      <li
                        key={idx}
                        className='ml-4 list-disc marker:text-brand-orange'
                      >
                        {paragraph.substring(2)}
                      </li>
                    )
                  }
                  if (!paragraph.trim()) {
                    return <br key={idx} />
                  }
                  return (
                    <p key={idx} className='mb-3 font-medium text-stone-700'>
                      {paragraph}
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
