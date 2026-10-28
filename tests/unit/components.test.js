import { describe, it, expect } from 'vitest'
import { TOKENS } from '../../src/ui/antislop.js'
import {
  el,
  section,
  skeleton,
  btn,
  inputField,
  selectField,
  textareaField,
  solidText,
  badge,
  statCard,
} from '../../src/ui/components.js'

describe('el', () => {
  it('membuat elemen dengan class, atribut, dan children', () => {
    const node = el('div', { className: 'card', 'data-id': '7' }, 'Halo', null)
    expect(node.tagName).toBe('DIV')
    expect(node.className).toBe('card')
    expect(node.getAttribute('data-id')).toBe('7')
    expect(node.textContent).toBe('Halo')
    expect(node.childNodes).toHaveLength(1) // null dilewati
  })

  it('mengikat handler onXxx sebagai event listener', () => {
    let clicked = false
    const node = el('button', { onClick: () => { clicked = true } }, 'Klik')
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicked).toBe(true)
  })
})

describe('section', () => {
  it('membuat card dengan judul dan isi', () => {
    const child = el('p', {}, 'Isi card')
    const card = section('Daftar Permintaan', child)
    expect(card.tagName).toBe('SECTION')
    expect(card.querySelector('h2').textContent).toBe('Daftar Permintaan')
    expect(card.contains(child)).toBe(true)
  })
})

describe('skeleton', () => {
  it('meneruskan opsi ke createSkeleton', () => {
    const sk = skeleton({ lines: 4 })
    expect(sk.children).toHaveLength(4)
  })
})

describe('btn', () => {
  it('membuat button dengan label dan handler klik', () => {
    let clicked = false
    const b = btn('Posting Jurnal', { onClick: () => { clicked = true } })
    expect(b.tagName).toBe('BUTTON')
    expect(b.textContent).toBe('Posting Jurnal')
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicked).toBe(true)
  })
})

describe('inputField', () => {
  it('melempar error tanpa id', () => {
    expect(() => inputField({ label: 'Nama' })).toThrow(/WAJIB memiliki id/)
  })

  it('menghubungkan label dengan input via htmlFor', () => {
    const group = inputField({ label: 'Nama Pelanggan', id: 'nama', required: true })
    const input = group.querySelector('input')
    expect(input.id).toBe('nama')
    const label = group.querySelector('label')
    expect(label.getAttribute('for')).toBe('nama')
    expect(label.querySelector('.required')).toBeTruthy()
    expect(input.required).toBe(true)
  })

  it('meneruskan nilai input ke callback onInput', () => {
    let received = null
    const group = inputField({ label: 'Nama', id: 'x', onInput: (v) => { received = v } })
    const input = group.querySelector('input')
    input.value = 'Budi'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(received).toBe('Budi')
  })
})

describe('selectField', () => {
  it('merender semua opsi', () => {
    const group = selectField({
      label: 'Kategori',
      id: 'kategori',
      options: [
        { value: '', label: '-- Pilih --' },
        { value: 'pendapatan', label: 'Pendapatan' },
      ],
    })
    const select = group.querySelector('select')
    expect(select.id).toBe('kategori')
    expect(select.options).toHaveLength(2)
    expect(select.options[1].value).toBe('pendapatan')
  })

  it('meneruskan nilai terpilih ke onChange', () => {
    let received = null
    const group = selectField({
      label: 'Kategori', id: 'k', options: [{ value: 'a', label: 'A' }],
      onChange: (v) => { received = v },
    })
    const select = group.querySelector('select')
    select.value = 'a'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(received).toBe('a')
  })
})

describe('textareaField', () => {
  it('mengatur rows dan nilai awal', () => {
    const group = textareaField({ label: 'Catatan', id: 'catatan', rows: 5, value: 'sudah bersih' })
    const ta = group.querySelector('textarea')
    expect(ta.id).toBe('catatan')
    expect(ta.getAttribute('rows')).toBe('5')
    expect(ta.value).toBe('sudah bersih')
  })
})

describe('solidText', () => {
  it('memakai warna token, bukan gradient', () => {
    const ref = document.createElement('span')
    ref.style.color = TOKENS.colors.primary
    const span = solidText('Satu Alur', 'primary')
    expect(span.style.color).toBe(ref.style.color)
  })
})

describe('badge', () => {
  it('merender teks huruf besar', () => {
    expect(badge('draft').textContent).toBe('DRAFT')
  })

  it('varian tak dikenal jatuh ke gaya draft', () => {
    const fallback = badge('X', 'draft')
    const unknown = badge('X', 'variananeh')
    expect(unknown.style.cssText).toBe(fallback.style.cssText)
  })
})

describe('statCard', () => {
  it('menampilkan label dan nilai', () => {
    const card = statCard({ label: 'Total Pendapatan', value: 'Rp1.000.000', variant: 'orange' })
    expect(card.className).toContain('stat-card')
    expect(card.className).toContain('orange')
    expect(card.querySelector('.stat-label').textContent).toBe('Total Pendapatan')
    expect(card.querySelector('.stat-value').textContent).toBe('Rp1.000.000')
    expect(card.querySelector('.stat-delta')).toBeNull()
  })

  it('menampilkan delta bila disediakan', () => {
    const card = statCard({ label: 'Laba', value: 'Rp500', delta: '↑ 12%', deltaType: 'positive' })
    const delta = card.querySelector('.stat-delta')
    expect(delta.textContent).toBe('↑ 12%')
    expect(delta.className).toContain('positive')
  })
})
