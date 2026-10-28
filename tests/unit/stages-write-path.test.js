import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Menguji jalur tulis (submit form) tiap stage memakai factory domain:
 * - request.js harus menyimpan lewat createRequest (trim + status draft + phone)
 * - offer.js harus menyimpan lewat createOffer (field lengkap + status draft)
 */

const { generateOfferMock, loadModelsMock, pickDefaultModelMock } = vi.hoisted(() => ({
  generateOfferMock: vi.fn(),
  loadModelsMock: vi.fn(),
  pickDefaultModelMock: vi.fn(),
}))

vi.mock('../../src/ai/agent.js', () => ({
  generateOffer: generateOfferMock,
  explainReport: vi.fn(),
}))

vi.mock('../../src/ai/models.js', () => ({
  loadModels: loadModelsMock,
  pickDefaultModel: pickDefaultModelMock,
  getModels: () => [],
}))

let getCloud
let cloud
let StageRequest
let StageOffer

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  generateOfferMock.mockReset()
  loadModelsMock.mockReset()
  pickDefaultModelMock.mockReset()

  loadModelsMock.mockResolvedValue([{ id: 'mock-model', name: 'Mock' }])
  pickDefaultModelMock.mockReturnValue({ id: 'mock-model', name: 'Mock' })

  ;({ getCloud } = await import('../../src/cloud.js'))
  StageRequest = await import('../../src/stages/request.js')
  StageOffer = await import('../../src/stages/offer.js')
  cloud = getCloud()
})

function fill(container, name, value) {
  const input = container.querySelector(`[name="${name}"]`)
  input.value = value
  return input
}

describe('stage Permintaan (request.js)', () => {
  it('menyimpan lewat createRequest: ter-trim, status draft, phone tersimpan', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    await StageRequest.render(container)

    fill(container, 'customer_name', '  PT Uji Jaya  ')
    fill(container, 'service_type', '  Pembersihan AC ')
    fill(container, 'location', ' Bandung ')
    fill(container, 'phone', '  0812-3456-7890 ')
    fill(container, 'description', '  15 unit AC split ')

    const form = container.querySelector('#request-form')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(async () => {
      const { data } = await cloud.database.from('requests').select('*').eq('customer_name', 'PT Uji Jaya')
      expect(data).toHaveLength(1)
    })

    const { data } = await cloud.database.from('requests').select('*').eq('customer_name', 'PT Uji Jaya')
    expect(data[0].service_type).toBe('Pembersihan AC')
    expect(data[0].location).toBe('Bandung')
    expect(data[0].phone).toBe('0812-3456-7890')
    expect(data[0].description).toBe('15 unit AC split')
    expect(data[0].status).toBe('draft')
    expect(data[0].owner_id).toBeTruthy()
  }, 20000)
})

describe('stage Penawaran (offer.js)', () => {
  it('menyimpan lewat createOffer dengan field lengkap dan status draft', async () => {
    generateOfferMock.mockResolvedValue({
      scope: 'Pembersihan AC split 15 unit di kantor tiga lantai.',
      price: 3500000,
      terms: 'Pembayaran 50% di muka, sisa setelah pekerjaan selesai.',
      notes: 'Harga termasuk penggantian filter.',
    })

    const container = document.createElement('div')
    document.body.appendChild(container)
    await StageOffer.render(container)

    const select = container.querySelector('select[name="request_id"]')
    select.value = select.options[1].value

    const generateBtn = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Hasilkan Penawaran'))
    generateBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Proposal Tervalidasi')
    })

    const saveBtn = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Simpan Penawaran'))
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await vi.waitFor(async () => {
      const { data } = await cloud.database.from('offers').select('*').eq('request_id', Number(select.value))
      expect(data.length).toBeGreaterThan(0)
    })

    const { data } = await cloud.database.from('offers').select('*').eq('request_id', Number(select.value))
    const offer = data.find((o) => o.validated_price === 3500000)
    expect(offer).toBeTruthy()
    expect(offer.status).toBe('draft')
    expect(offer.validated_scope).toMatch(/Pembersihan AC split 15 unit/)
    expect(offer.ai_proposal_json.price).toBe(3500000)
    expect(offer.owner_id).toBeTruthy()
  }, 20000)
})
