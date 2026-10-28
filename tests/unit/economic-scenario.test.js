import { describe, it, expect } from 'vitest'
import { validateOffer, OfferRules } from '../../src/domain/rules.js'

/**
 * Skenario ekonomi riil untuk perusahaan jasa kebersihan di kota daerah.
 * Kasus: 12 bulan (2026), pertumbuhan nasional 5%/tahun, daerah 8–10%/tahun.
 * Semua angka deterministik — tidak ada Math.random — agar bisa jadi kontrak.
 */

const MONTHS = 12
const BASE_MONTHLY_REVENUE = 185_000_000 // Rp185 juta/bulan, skala UMKM jasa
const WORKERS = 12
const UMK_BULANAN = 4_600_000 // UMK kota daerah, konservatif

// Biaya langsung sebagai porsi pendapatan; total 63% -> margin kotor 37%.
const COST_MIX = {
  biaya_tenaga: 0.34,
  biaya_bahan: 0.16,
  biaya_transport: 0.07,
  biaya_lain: 0.06,
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

// Deret pendapatan dengan bunga majemuk bulanan dari target tahunan.
function monthlyRevenue(annualGrowth, base = BASE_MONTHLY_REVENUE) {
  const monthly = (1 + annualGrowth) ** (1 / 12) - 1
  return Array.from({ length: MONTHS }, (_, i) => Math.round(base * (1 + monthly) ** i))
}

// Satu bulan = 1 baris pendapatan + 4 baris biaya (bentuk ledger_entries).
function buildLedger(revenues) {
  const entries = []
  revenues.forEach((revenue, i) => {
    const period = `2026-${String(i + 1).padStart(2, '0')}`
    entries.push({ period, category: 'pendapatan', amount: revenue })
    for (const [category, share] of Object.entries(COST_MIX)) {
      entries.push({ period, category, amount: Math.round(revenue * share) })
    }
  })
  return entries
}

function summarize(entries) {
  const revenue = entries
    .filter((e) => e.category === 'pendapatan')
    .reduce((sum, e) => sum + e.amount, 0)
  const cost = entries
    .filter((e) => e.category !== 'pendapatan')
    .reduce((sum, e) => sum + e.amount, 0)
  return { revenue, cost, profit: revenue - cost, margin: (revenue - cost) / revenue }
}

// Deret 12 titik menjangkau 11 bulan; annualisasi ke 12 bulan.
function annualizedGrowth(series) {
  return (series.at(-1) / series[0]) ** (12 / (series.length - 1)) - 1
}

const nasional = monthlyRevenue(0.05)
const daerahMin = monthlyRevenue(0.08)
const daerahMax = monthlyRevenue(0.10)

describe('asumsi pertumbuhan ekonomi', () => {
  it('nasional tumbuh sekitar 5% per tahun', () => {
    expect(annualizedGrowth(nasional)).toBeGreaterThan(0.045)
    expect(annualizedGrowth(nasional)).toBeLessThan(0.055)
  })

  it.each([
    ['batas bawah', daerahMin, 0.08],
    ['batas atas', daerahMax, 0.10],
  ])('daerah %s tumbuh dalam band 8–10%%', (_label, series, target) => {
    const growth = annualizedGrowth(series)
    expect(growth).toBeGreaterThan(0.079)
    expect(growth).toBeLessThan(0.101)
    expect(growth).toBeCloseTo(target, 3)
  })

  it('daerah tumbuh 3–5 poin persen lebih cepat dari nasional', () => {
    const gap = annualizedGrowth(daerahMin) - annualizedGrowth(nasional)
    expect(gap).toBeGreaterThanOrEqual(0.029)
    expect(gap).toBeLessThanOrEqual(0.051)
  })
})

describe('laba dan margin per bulan', () => {
  it.each(MONTH_LABELS.map((label, i) => [label, i]))(
    '%s: laba positif dengan margin wajar (25–40%%)',
    (_label, i) => {
      const entries = buildLedger(daerahMin).filter((e) => e.period === `2026-${String(i + 1).padStart(2, '0')}`)
      const { profit, margin } = summarize(entries)
      expect(profit).toBeGreaterThan(0)
      expect(margin).toBeGreaterThan(0.25)
      expect(margin).toBeLessThan(0.40)
    }
  )

  it('laba nominal naik seiring pertumbuhan pendapatan', () => {
    const revenues = monthlyRevenue(0.08)
    const profitOf = (revenue) => revenue - Math.round(revenue * 0.63)
    expect(profitOf(revenues.at(-1))).toBeGreaterThan(profitOf(revenues[0]))
  })
})

describe('realisme struktur biaya', () => {
  it('biaya tenaga kerja per pekerja di atas UMK kota', () => {
    const laborPerMonth = BASE_MONTHLY_REVENUE * COST_MIX.biaya_tenaga
    expect(laborPerMonth / WORKERS).toBeGreaterThan(UMK_BULANAN)
  })

  it('biaya tenaga kerja adalah komponen biaya terbesar', () => {
    const shares = Object.values(COST_MIX)
    expect(COST_MIX.biaya_tenaga).toBe(Math.max(...shares))
  })
})

describe('agregasi laporan 12 bulan', () => {
  const entries = buildLedger(daerahMin)
  const totals = summarize(entries)

  it('menghasilkan 60 baris ledger (12 bulan x 5 kategori)', () => {
    expect(entries).toHaveLength(MONTHS * 5)
  })

  it('total pendapatan sama dengan penjumlahan deret bulanan', () => {
    expect(totals.revenue).toBe(daerahMin.reduce((sum, v) => sum + v, 0))
  })

  it('pendapatan - biaya = laba, dan margin tahunan wajar', () => {
    expect(totals.revenue - totals.cost).toBe(totals.profit)
    expect(totals.profit).toBeGreaterThan(0)
    expect(totals.margin).toBeGreaterThan(0.30)
    expect(totals.margin).toBeLessThan(0.40)
  })
})

describe('harga kontrak dalam skenario', () => {
  const offers = [
    { scope: 'Pembersihan AC split 15 unit untuk kantor tiga lantai.', price: 3_500_000, terms: 'Pembayaran 50% di muka, sisa setelah pekerjaan selesai.' },
    { scope: 'Pest control rayap dan kecoa untuk gudang seluas 500m2.', price: 4_200_000, terms: 'Kontrak tiga bulan dengan garansi enam bulan.' },
    { scope: 'Deep cleaning 50 kamar hotel setelah musim liburan.', price: 15_000_000, terms: 'Termin mingguan, target sepuluh kamar per hari.' },
  ]

  it.each(offers)('Rp$price lolos validasi domain', (offer) => {
    expect(offer.price).toBeGreaterThanOrEqual(OfferRules.minPrice)
    expect(offer.price).toBeLessThanOrEqual(OfferRules.maxPrice)
    expect(validateOffer(offer)).toEqual({ valid: true, errors: [] })
  })
})
