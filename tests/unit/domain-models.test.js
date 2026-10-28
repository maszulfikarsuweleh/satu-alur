import { describe, it, expect } from 'vitest'
import { ServiceStatus, createRequest, createOffer } from '../../src/domain/models.js'

describe('createRequest', () => {
  it('memotong spasi di awal/akhir semua field', () => {
    const req = createRequest({
      customer_name: '  PT Maju Jaya  ',
      service_type: ' Pembersihan AC ',
      location: '  Jakarta Selatan ',
      description: '  AC 15 unit  ',
    })
    expect(req.customer_name).toBe('PT Maju Jaya')
    expect(req.service_type).toBe('Pembersihan AC')
    expect(req.location).toBe('Jakarta Selatan')
    expect(req.description).toBe('AC 15 unit')
  })

  it('mengisi field kosong dengan string kosong', () => {
    const req = createRequest({})
    expect(req.customer_name).toBe('')
    expect(req.service_type).toBe('')
    expect(req.location).toBe('')
    expect(req.description).toBe('')
  })

  it('menyertakan nomor telepon yang sudah di-trim', () => {
    expect(createRequest({ phone: '  0812-3456-7890 ' }).phone).toBe('0812-3456-7890')
    expect(createRequest({}).phone).toBe('')
  })

  it('tidak melempar saat dipanggil tanpa argumen', () => {
    expect(() => createRequest()).not.toThrow()
    expect(createRequest().customer_name).toBe('')
  })

  it('status default draft', () => {
    expect(createRequest({ customer_name: 'X' }).status).toBe(ServiceStatus.REQUEST.DRAFT)
  })
})

describe('createOffer', () => {
  const proposal = { scope: 'Pembersihan AC split 15 unit.', price: 3500000, terms: 'Pembayaran 50% di muka.' }

  it('memetakan semua field', () => {
    const offer = createOffer(1, proposal, 3500000, 'Pembersihan AC split 15 unit.')
    expect(offer.request_id).toBe(1)
    expect(offer.ai_proposal_json).toEqual(proposal)
    expect(offer.validated_price).toBe(3500000)
    expect(offer.validated_scope).toBe('Pembersihan AC split 15 unit.')
  })

  it('status default draft', () => {
    expect(createOffer(1, proposal, 3500000, 'scope').status).toBe(ServiceStatus.OFFER.DRAFT)
  })
})

describe('ServiceStatus', () => {
  it('memuat enam kelompok status', () => {
    expect(Object.keys(ServiceStatus).sort()).toEqual(
      ['ASSIGN', 'COMPLETE', 'LEDGER', 'OFFER', 'REPORT', 'REQUEST'].sort()
    )
  })

  it('alur offer bergerak draft -> pending_approval -> approved', () => {
    expect(ServiceStatus.OFFER.DRAFT).toBe('draft')
    expect(ServiceStatus.OFFER.PENDING_APPROVAL).toBe('pending_approval')
    expect(ServiceStatus.OFFER.APPROVED).toBe('approved')
  })
})
