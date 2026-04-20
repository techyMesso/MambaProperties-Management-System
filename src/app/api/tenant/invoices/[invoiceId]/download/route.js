import { NextResponse } from 'next/server'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const isColumnMissingError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const runQuery = safeQuery

const normalizeStatus = value => String(value || '').trim().toLowerCase()

const toAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const formatKES = value => `KES ${Math.max(0, toAmount(value)).toLocaleString('en-KE')}`

const sanitizeFileName = value =>
  String(value || 'invoice')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'invoice'

const sanitizePdfText = value =>
  String(value || '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/([\\()])/g, '\\$1')

const formatDate = value => {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return parsed.toISOString().slice(0, 10)
}

const formatSignedKES = value => {
  const amount = toAmount(value)

  if (amount <= 0) {
    return 'KES 0'
  }

  return `KES ${amount.toLocaleString('en-KE')}`
}

const resolveRouteParams = async params => (params ? await params : {})

const textCommand = ({ x, y, size = 12, text = '', font = 'F1', color = [0, 0, 0] }) =>
  `BT /${font} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} Td (${sanitizePdfText(text)}) Tj ET`

const fillRectCommand = ({ x, y, width, height, color = [1, 1, 1] }) =>
  `${color[0]} ${color[1]} ${color[2]} rg ${x} ${y} ${width} ${height} re f`

const strokeRectCommand = ({ x, y, width, height, color = [0.8, 0.84, 0.88], lineWidth = 1 }) =>
  `${color[0]} ${color[1]} ${color[2]} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S`

const lineCommand = ({ x1, y1, x2, y2, color = [0.86, 0.9, 0.94], lineWidth = 1 }) =>
  `${color[0]} ${color[1]} ${color[2]} RG ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S`

const buildPdfBytes = ({ invoiceNo, tenantName, ownerId, period, dueAmount, paidAmount, outstandingAmount, status, createdAt }) => {
  const generatedAt = formatDate(Date.now())
  const issuedAt = formatDate(createdAt || Date.now())

  const rows = [
    { item: 'Rent charge', detail: period, amount: formatSignedKES(dueAmount) },
    { item: 'Payments received', detail: 'Confirmed records', amount: paidAmount > 0 ? `- ${formatSignedKES(paidAmount)}` : 'KES 0' },
    { item: 'Outstanding balance', detail: 'Amount due now', amount: formatSignedKES(outstandingAmount), bold: true }
  ]

  const commands = []

  commands.push(fillRectCommand({ x: 0, y: 750, width: 595, height: 92, color: [0.06, 0.22, 0.4] }))
  commands.push(fillRectCommand({ x: 50, y: 773, width: 34, height: 34, color: [1, 1, 1] }))
  commands.push(textCommand({ x: 62, y: 785, size: 16, text: 'M', font: 'F2', color: [0.06, 0.22, 0.4] }))
  commands.push(textCommand({ x: 95, y: 803, size: 18, text: 'Mambaproperties Invoice', font: 'F2', color: [1, 1, 1] }))
  commands.push(textCommand({ x: 95, y: 786, size: 10, text: 'Kenya Rental SaaS | Rent Collection Statement', color: [0.88, 0.95, 1] }))

  commands.push(fillRectCommand({ x: 50, y: 670, width: 495, height: 66, color: [0.94, 0.98, 1] }))
  commands.push(strokeRectCommand({ x: 50, y: 670, width: 495, height: 66, color: [0.78, 0.87, 0.94] }))
  commands.push(textCommand({ x: 62, y: 718, size: 10, text: `Invoice No: ${invoiceNo}`, font: 'F2', color: [0.08, 0.2, 0.32] }))
  commands.push(textCommand({ x: 62, y: 702, size: 10, text: `Tenant: ${tenantName}`, color: [0.13, 0.22, 0.35] }))
  commands.push(textCommand({ x: 62, y: 686, size: 10, text: `Billing Period: ${period}`, color: [0.13, 0.22, 0.35] }))
  commands.push(textCommand({ x: 330, y: 718, size: 10, text: `Landlord ID: ${ownerId}`, color: [0.13, 0.22, 0.35] }))
  commands.push(textCommand({ x: 330, y: 702, size: 10, text: `Issued Date: ${issuedAt}`, color: [0.13, 0.22, 0.35] }))
  commands.push(textCommand({ x: 330, y: 686, size: 10, text: `Generated: ${generatedAt}`, color: [0.13, 0.22, 0.35] }))

  const tableX = 50
  const tableY = 510
  const tableWidth = 495
  const rowHeight = 30
  const headerHeight = 32
  const column1 = tableX + 18
  const column2 = tableX + 280
  const column3 = tableX + 430

  commands.push(fillRectCommand({ x: tableX, y: tableY + rowHeight * rows.length, width: tableWidth, height: headerHeight, color: [0.08, 0.55, 0.56] }))
  commands.push(strokeRectCommand({ x: tableX, y: tableY, width: tableWidth, height: headerHeight + rowHeight * rows.length, color: [0.78, 0.87, 0.94] }))
  commands.push(lineCommand({ x1: tableX + 250, y1: tableY, x2: tableX + 250, y2: tableY + headerHeight + rowHeight * rows.length }))
  commands.push(lineCommand({ x1: tableX + 410, y1: tableY, x2: tableX + 410, y2: tableY + headerHeight + rowHeight * rows.length }))

  rows.forEach((_, index) => {
    const y = tableY + rowHeight * index

    commands.push(lineCommand({ x1: tableX, y1: y, x2: tableX + tableWidth, y2: y }))
  })

  commands.push(textCommand({ x: column1, y: tableY + rowHeight * rows.length + 11, size: 10, text: 'Description', font: 'F2', color: [1, 1, 1] }))
  commands.push(textCommand({ x: column2, y: tableY + rowHeight * rows.length + 11, size: 10, text: 'Detail', font: 'F2', color: [1, 1, 1] }))
  commands.push(textCommand({ x: column3, y: tableY + rowHeight * rows.length + 11, size: 10, text: 'Amount', font: 'F2', color: [1, 1, 1] }))

  rows.forEach((row, index) => {
    const y = tableY + rowHeight * (rows.length - index - 1) + 11
    const font = row.bold ? 'F2' : 'F1'

    commands.push(textCommand({ x: column1, y, size: 10, text: row.item, font, color: [0.09, 0.19, 0.31] }))
    commands.push(textCommand({ x: column2, y, size: 10, text: row.detail, font: 'F1', color: [0.2, 0.3, 0.43] }))
    commands.push(textCommand({ x: column3, y, size: 10, text: row.amount, font, color: [0.09, 0.19, 0.31] }))
  })

  commands.push(textCommand({ x: 50, y: 448, size: 10, text: `Invoice Status: ${String(status || 'pending').toUpperCase()}`, font: 'F2', color: [0.08, 0.2, 0.34] }))
  commands.push(textCommand({ x: 50, y: 430, size: 9, text: 'Payment Methods: M-Pesa STK Push, Bank Transfer, Card / Other', color: [0.24, 0.32, 0.44] }))
  commands.push(textCommand({ x: 50, y: 95, size: 8, text: 'Mambaproperties | support@mambaproperties.co.ke | +254 700 000 000', color: [0.42, 0.48, 0.55] }))
  commands.push(textCommand({ x: 50, y: 80, size: 8, text: 'This document is generated electronically from your tenant portal.', color: [0.42, 0.48, 0.55] }))

  const stream = commands.join('\n')
  const streamLength = Buffer.byteLength(stream, 'ascii')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []

  objects.forEach(obj => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += obj
  })

  const xrefStart = Buffer.byteLength(pdf, 'ascii')

  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`

  offsets.forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n 
`
  })

  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefStart}
%%EOF`

  return Buffer.from(pdf, 'ascii')
}

export async function GET(request, { params }) {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return API_RESPONSES.unauthorized(request)
  }

  const role = await resolveUserRole(supabase, user)

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenants can download this invoice copy.')
  }

  const routeParams = await resolveRouteParams(params)
  const invoiceId = String(routeParams?.invoiceId || '').trim()

  if (!invoiceId) {
    return API_RESPONSES.badRequest(request, 'Missing invoice id.')
  }

  const tenantResult = await runQuery(supabase.from('tenants').select('id,owner_id,tenant_name').eq('auth_user_id', user.id).limit(25))

  if (tenantResult.error) {
    return API_RESPONSES.badRequest(request, tenantResult.error.message || 'Unable to load tenant profile.')
  }

  const tenantRows = tenantResult.data || []
  const tenantIds = tenantRows.map(row => row.id).filter(Boolean)
  const ownerIds = [...new Set(tenantRows.map(row => row.owner_id).filter(Boolean))]
  const tenantNames = [...new Set(tenantRows.map(row => String(row.tenant_name || '').trim()).filter(Boolean))]

  if (!tenantRows.length) {
    return API_RESPONSES.forbidden(request, 'Tenant mapping not found for this account.')
  }

  let invoice = null

  if (tenantIds.length) {
    let byTenantIdQuery = supabase
      .from('invoices')
      .select('id,owner_id,invoice_no,tenant_name,period,due_amount,status,created_at')
      .eq('id', invoiceId)
      .in('tenant_id', tenantIds)
      .maybeSingle()

    if (ownerIds.length) {
      byTenantIdQuery = byTenantIdQuery.in('owner_id', ownerIds)
    }

    const byTenantId = await runQuery(byTenantIdQuery)

    if (!byTenantId.error && byTenantId.data) {
      invoice = byTenantId.data
    } else if (byTenantId.error && !isColumnMissingError(byTenantId.error)) {
      return API_RESPONSES.badRequest(request, byTenantId.error.message || 'Unable to load invoice.')
    }
  }

  if (!invoice && tenantNames.length) {
    let byTenantNameQuery = supabase
      .from('invoices')
      .select('id,owner_id,invoice_no,tenant_name,period,due_amount,status,created_at')
      .eq('id', invoiceId)
      .in('tenant_name', tenantNames)
      .maybeSingle()

    if (ownerIds.length) {
      byTenantNameQuery = byTenantNameQuery.in('owner_id', ownerIds)
    }

    const byTenantName = await runQuery(byTenantNameQuery)

    if (byTenantName.error) {
      return API_RESPONSES.badRequest(request, byTenantName.error.message || 'Unable to load invoice.')
    }

    invoice = byTenantName.data
  }

  if (!invoice) {
    return API_RESPONSES.notFound(request, 'Invoice not found for this tenant account.')
  }

  const invoicePayments = []

  const byInvoiceId = await runQuery(
    supabase.from('payments').select('amount,status,invoice_id,tenant_name').eq('owner_id', invoice.owner_id).eq('invoice_id', invoice.id).limit(200)
  )

  if (byInvoiceId.error && !isColumnMissingError(byInvoiceId.error)) {
    return API_RESPONSES.badRequest(request, byInvoiceId.error.message || 'Unable to read payments for invoice.')
  }

  if (!byInvoiceId.error) {
    invoicePayments.push(...(byInvoiceId.data || []))
  } else {
    const byTenantName = await runQuery(
      supabase
        .from('payments')
        .select('amount,status,tenant_name')
        .eq('owner_id', invoice.owner_id)
        .eq('tenant_name', invoice.tenant_name)
        .limit(200)
    )

    if (byTenantName.error) {
      return API_RESPONSES.badRequest(request, byTenantName.error.message || 'Unable to read payments for invoice.')
    }

    invoicePayments.push(...(byTenantName.data || []))
  }

  const paidAmount = invoicePayments.reduce((total, row) => {
    const status = normalizeStatus(row?.status)

    if (!['paid', 'partial'].includes(status)) {
      return total
    }

    return total + toAmount(row?.amount)
  }, 0)

  const dueAmount = toAmount(invoice.due_amount)
  const outstandingAmount = Math.max(0, dueAmount - paidAmount)
  const status = String(invoice.status || '').trim() || (outstandingAmount <= 0 ? 'paid' : 'pending')
  const invoiceNo = String(invoice.invoice_no || 'invoice').trim()
  const tenantName = String(invoice.tenant_name || tenantRows[0]?.tenant_name || 'Tenant').trim()
  const period = String(invoice.period || 'Current Period').trim()

  const pdfBytes = buildPdfBytes({
    invoiceNo,
    tenantName,
    ownerId: invoice.owner_id,
    period,
    dueAmount,
    paidAmount,
    outstandingAmount,
    status,
    createdAt: invoice.created_at
  })

  const fileName = sanitizeFileName(invoiceNo)

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
      'Cache-Control': 'no-store'
    }
  })
}
