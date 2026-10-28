import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  TOKENS,
  CONSTRAINTS,
  solidColor,
  size,
  VALIDATOR,
  CONTENT_GATE,
  ANTI_PATTERNS,
  createSkeleton,
  injectAntiSlopStyles,
  enableDevAudit,
} from '../../src/ui/antislop.js'

describe('TOKENS', () => {
  it('ter-freeze (immutable)', () => {
    expect(Object.isFrozen(TOKENS)).toBe(true)
  })

  it('tidak mengandung gradient', () => {
    expect(JSON.stringify(TOKENS).toLowerCase()).not.toContain('gradient')
  })

  it('batas tap minimum 44px (WCAG)', () => {
    expect(CONSTRAINTS.minTap).toBe(44)
  })
})

describe('solidColor', () => {
  it('mengembalikan warna primary', () => {
    expect(solidColor('primary')).toBe('#e67e22')
  })

  it('menerima nama accent', () => {
    expect(solidColor('orange')).toBe('#e67e22')
    expect(solidColor('sand')).toBe('#d4a574')
  })

  it('melempar error untuk nama tak dikenal', () => {
    expect(() => solidColor('rainbow')).toThrow(/tidak terdaftar/)
  })
})

describe('size', () => {
  it('menerima nilai spacing terdaftar', () => {
    expect(size(8)).toBe(8)
  })

  it('mengembalikan fallback + warning untuk nilai liar', () => {
    const warn = vi.mocked(console.warn)
    const result = size(13)
    expect(result).toBe(TOKENS.spacing.md)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('13px'))
  })
})

describe('VALIDATOR.input', () => {
  const makeInput = (id) => {
    const el = document.createElement('input')
    if (id) el.id = id
    return el
  }

  it('lolos untuk input ber-id dan ber-label', () => {
    expect(VALIDATOR.input(makeInput('nama'), 'Nama Pelanggan')).toBe(true)
  })

  it('gagal jika label terlalu pendek', () => {
    expect(VALIDATOR.input(makeInput('nama'), 'N')).toBe(false)
  })

  it('gagal jika tidak ada id dan aria-label', () => {
    expect(VALIDATOR.input(makeInput(''), 'Nama Pelanggan')).toBe(false)
  })

  it('lolos dengan aria-label meski tanpa id', () => {
    const el = document.createElement('input')
    el.setAttribute('aria-label', 'Nama')
    expect(VALIDATOR.input(el, 'Nama Pelanggan')).toBe(true)
  })
})

describe('VALIDATOR.card', () => {
  it('lolos untuk card ber-title dan ber-isi', () => {
    const card = document.createElement('section')
    card.appendChild(document.createElement('p'))
    expect(VALIDATOR.card(card, 'Daftar Permintaan')).toBe(true)
  })

  it('gagal jika title terlalu pendek', () => {
    const card = document.createElement('section')
    card.appendChild(document.createElement('p'))
    expect(VALIDATOR.card(card, 'ab')).toBe(false)
  })

  it('gagal jika card kosong', () => {
    const card = document.createElement('section')
    expect(VALIDATOR.card(card, 'Judul Panjang')).toBe(false)
  })
})

describe('VALIDATOR.button', () => {
  it('gagal jika label kosong', () => {
    const btn = document.createElement('button')
    expect(VALIDATOR.button(btn, '   ')).toBe(false)
  })

  it('gagal jika ukuran tap di bawah 44px (default jsdom = 0)', () => {
    const btn = document.createElement('button')
    expect(VALIDATOR.button(btn, 'Klik')).toBe(false)
  })

  it('lolos jika ukuran tap memenuhi 44px', () => {
    const btn = document.createElement('button')
    Object.defineProperty(btn, 'offsetWidth', { value: 44, configurable: true })
    Object.defineProperty(btn, 'offsetHeight', { value: 44, configurable: true })
    expect(VALIDATOR.button(btn, 'Klik')).toBe(true)
  })
})

describe('VALIDATOR.noPlaceholderLabel', () => {
  it('gagal jika placeholder tanpa label/aria-label', () => {
    const input = document.createElement('input')
    input.id = 'tanpa-label'
    input.setAttribute('placeholder', 'Isi di sini')
    document.body.appendChild(input)
    expect(VALIDATOR.noPlaceholderLabel(input)).toBe(false)
    input.remove()
  })

  it('lolos jika ada label[for]', () => {
    const label = document.createElement('label')
    label.setAttribute('for', 'dengan-label')
    document.body.appendChild(label)
    const input = document.createElement('input')
    input.id = 'dengan-label'
    input.setAttribute('placeholder', 'Isi di sini')
    document.body.appendChild(input)
    expect(VALIDATOR.noPlaceholderLabel(input)).toBe(true)
    label.remove()
    input.remove()
  })

  it('lolos jika tanpa placeholder', () => {
    const input = document.createElement('input')
    expect(VALIDATOR.noPlaceholderLabel(input)).toBe(true)
  })
})

describe('CONTENT_GATE.scan', () => {
  it('lolos untuk konten deskriptif', () => {
    const result = CONTENT_GATE.scan('Pembersihan AC split 15 unit di kantor tiga lantai.', 'test')
    expect(result.clean).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('menandai lorem ipsum', () => {
    const result = CONTENT_GATE.scan('Lorem ipsum dolor sit amet consectetur', 'test')
    expect(result.clean).toBe(false)
    expect(result.issues.join(' ')).toMatch(/placeholder\/slop/)
  })

  it('menandai kata TODO', () => {
    const result = CONTENT_GATE.scan('Isi deskripsi TODO nanti ya', 'test')
    expect(result.clean).toBe(false)
  })

  it('menandai teks berakhiran elipsis', () => {
    const result = CONTENT_GATE.scan('Deskripsi belum lengkap...', 'test')
    expect(result.clean).toBe(false)
  })

  it('menandai konten terlalu pendek', () => {
    const result = CONTENT_GATE.scan('Pendek', 'test')
    expect(result.clean).toBe(false)
    expect(result.issues.join(' ')).toMatch(/terlalu pendek/)
  })

  it('menandai konten dengan lebih dari 3 weak words', () => {
    const result = CONTENT_GATE.scan('bagus nice good very sangat untuk pelanggan', 'test')
    expect(result.issues.join(' ')).toMatch(/terlalu generik/)
  })

  it('mengabaikan non-string', () => {
    expect(CONTENT_GATE.scan(null, 'test')).toEqual({ clean: true, issues: [] })
  })
})

describe('CONTENT_GATE.buttonLabel', () => {
  it('lolos untuk label wajar', () => {
    expect(CONTENT_GATE.buttonLabel('Posting Jurnal').clean).toBe(true)
  })

  it('gagal untuk label di atas 30 karakter', () => {
    const result = CONTENT_GATE.buttonLabel('Simpan Dan Tutup Semua Pengaturan Ini Sekarang')
    expect(result.clean).toBe(false)
    expect(result.issues.join(' ')).toMatch(/terlalu panjang/)
  })

  it('menandai label pendek (quirk: scan mensyaratkan >= 10 karakter)', () => {
    // Perilaku saat ini: scan() menandai teks < 10 karakter, jadi label pendek pun tercatat sebagai issue.
    const result = CONTENT_GATE.buttonLabel('Keluar')
    expect(result.clean).toBe(false)
  })
})

describe('createSkeleton', () => {
  it('menghasilkan wrapper aria-busy dengan jumlah baris sesuai', () => {
    const sk = createSkeleton({ lines: 3 })
    expect(sk.getAttribute('aria-busy')).toBe('true')
    expect(sk.children).toHaveLength(3)
  })

  it('baris terakhir menyempit saat lines > 1', () => {
    const sk = createSkeleton({ lines: 2 })
    expect(sk.children[1].style.width).toBe('60%')
  })

  it('default satu baris penuh', () => {
    const sk = createSkeleton({})
    expect(sk.children).toHaveLength(1)
    expect(sk.children[0].style.width).toBe('100%')
  })
})

describe('ANTI_PATTERNS.detect', () => {
  it('menemukan hardcoded color, img tanpa alt, dan link kosong', () => {
    const div = document.createElement('div')
    div.setAttribute('style', 'color:#ff0000;padding:8px;')
    document.body.appendChild(div)

    const img = document.createElement('img')
    document.body.appendChild(img)

    const link = document.createElement('a')
    document.body.appendChild(link)

    const issues = ANTI_PATTERNS.detect()
    const types = issues.map((i) => i.type)

    expect(types).toContain('hardcoded-color')
    expect(types).toContain('missing-alt')
    expect(types).toContain('empty-link')

    div.remove()
    img.remove()
    link.remove()
  })
})

describe('enableDevAudit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mengembalikan fungsi stop yang menghentikan audit berkala', () => {
    vi.useFakeTimers()
    const detect = vi.spyOn(ANTI_PATTERNS, 'detect').mockImplementation(() => [])

    const stop = enableDevAudit(1000)
    expect(typeof stop).toBe('function')

    vi.advanceTimersByTime(1000)
    expect(detect).toHaveBeenCalledTimes(1)

    stop()
    vi.advanceTimersByTime(5000)
    expect(detect).toHaveBeenCalledTimes(1)
  })
})

describe('injectAntiSlopStyles', () => {
  it('idempoten: dua kali panggilan hanya membuat satu style', () => {
    injectAntiSlopStyles()
    injectAntiSlopStyles()
    expect(document.querySelectorAll('#antislop-styles')).toHaveLength(1)
  })
})
