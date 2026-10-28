import { describe, it, expect } from 'vitest'
import { validateOffer, canTransition, OfferRules, OfferTransitions } from '../../src/domain/rules.js'

const validOffer = {
  scope: 'Pembersihan AC split 15 unit di kantor tiga lantai.',
  price: 3500000,
  terms: 'Pembayaran 50% di muka, sisa setelah pekerjaan selesai.',
}

describe('OfferRules', () => {
  it('menetapkan batas harga dan field wajib', () => {
    expect(OfferRules.minPrice).toBe(10000)
    expect(OfferRules.maxPrice).toBe(1000000000)
    expect(OfferRules.requiredFields).toEqual(['scope', 'price', 'terms'])
  })
})

describe('validateOffer', () => {
  it('menolak proposal kosong', () => {
    const result = validateOffer(null)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Proposal AI kosong.')
  })

  it('menerima proposal lengkap', () => {
    const result = validateOffer(validOffer)
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('menolak harga di bawah batas minimum', () => {
    const result = validateOffer({ ...validOffer, price: 9999 })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Harga harus antara/)
  })

  it('menolak harga di atas batas maksimum', () => {
    const result = validateOffer({ ...validOffer, price: 1000000001 })
    expect(result.valid).toBe(false)
  })

  it('menolak harga non-numerik', () => {
    const result = validateOffer({ ...validOffer, price: 'gratis' })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Harga harus antara/)
  })

  it('menerima harga berupa string numerik', () => {
    const result = validateOffer({ ...validOffer, price: '500000' })
    expect(result.valid).toBe(true)
  })

  it('menerima harga tepat di batas minimum dan maksimum', () => {
    expect(validateOffer({ ...validOffer, price: 10000 }).valid).toBe(true)
    expect(validateOffer({ ...validOffer, price: 1000000000 }).valid).toBe(true)
  })

  it('menolak scope yang terlalu pendek', () => {
    const result = validateOffer({ ...validOffer, scope: 'cuci ac' })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Ruang lingkup/)
  })

  it('menolak terms yang terlalu pendek', () => {
    const result = validateOffer({ ...validOffer, terms: 'lunas' })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Ketentuan/)
  })

  it('mengumpulkan semua error sekaligus', () => {
    const result = validateOffer({ scope: '', price: 0, terms: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(3)
  })
})

describe('canTransition', () => {
  it('mengizinkan draft -> pending_approval', () => {
    expect(canTransition('draft', 'pending_approval', OfferTransitions)).toBe(true)
  })

  it('menolak draft -> approved (harus lewat pending_approval)', () => {
    expect(canTransition('draft', 'approved', OfferTransitions)).toBe(false)
  })

  it('menolak approved -> rejected', () => {
    expect(canTransition('approved', 'rejected', OfferTransitions)).toBe(false)
  })

  it('mengizinkan pending_approval -> approved dan rejected', () => {
    expect(canTransition('pending_approval', 'approved', OfferTransitions)).toBe(true)
    expect(canTransition('pending_approval', 'rejected', OfferTransitions)).toBe(true)
  })

  it('mengembalikan false untuk status tak dikenal', () => {
    expect(canTransition('entah', 'approved', OfferTransitions)).toBe(false)
  })
})
