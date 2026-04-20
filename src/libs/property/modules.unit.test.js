import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { getModuleDefinition } from './modules.js'

describe('property module transforms', () => {
  it('converts numeric fields with toNumber via units.toInsert', () => {
    const units = getModuleDefinition('units')
    const payload = units.toInsert({ rent: '' })

    assert.equal(payload.rent, null)
  })

  it('normalizes amenities via units.toInsert', () => {
    const units = getModuleDefinition('units')
    const payload = units.toInsert({ amenities: 'pool, gym, , wifi ' })

    assert.deepEqual(payload.amenities, ['pool', 'gym', 'wifi'])
  })

  it('normalizes strings via units.toInsert', () => {
    const units = getModuleDefinition('units')
    const payload = units.toInsert({ category: '  Apartment  ' })

    assert.equal(payload.category, 'Apartment')
  })

  it('converts dates via documents.toInsert', () => {
    const documents = getModuleDefinition('documents')
    const payload = documents.toInsert({ uploaded: '2026-03-01' })

    assert.equal(payload.uploaded, '2026-03-01')
  })

  it('converts timestamps via messaging.toInsert', () => {
    const messaging = getModuleDefinition('messaging')
    const payload = messaging.toInsert({ lastUpdate: '2026-03-01T10:00:00Z' })

    assert.equal(payload.last_update, '2026-03-01T10:00:00.000Z')
  })

  it('formats ISO datetime local strings via paymentsMonitoring.toRows', () => {
    const paymentsMonitoring = getModuleDefinition('paymentsMonitoring')
    const rows = paymentsMonitoring.toRows([{ createdAt: '2026-03-12T10:15:30.000Z' }])

    assert.equal(rows[0].createdAt, '2026-03-12T10:15')
  })

  it('generates codes when identifiers are missing', () => {
    const invoices = getModuleDefinition('invoices')
    const payload = invoices.toInsert({ invoiceNo: '' })

    assert.match(payload.invoice_no, /^INV-\d{8}-\d{3}$/)
  })
})
