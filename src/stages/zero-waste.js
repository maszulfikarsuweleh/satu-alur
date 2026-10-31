/**
 * Pendapatan — Tanpa Limbah (zero waste).
 *
 * The premise: income has two levers. Raise what comes in (VAS) and stop what
 * leaks out. This page owns the second lever across five streams, measures the
 * leak in Rupiah against recorded findings, and shows honest progress toward
 * zero.
 *
 * Tabs: Pemborosan (state of play) · Tindakan (findings CRUD) · Ruang optimasi.
 */
import '../styles/pendapatan.css'
import * as C from '../ui/components.js'
import { showToast } from '../ui/animations.js'
import { getCloud } from '../cloud.js'
import { loadFlow, notifyDataChanged } from './data.js'
import {
  WASTE_STREAMS, WASTE_STATUSES, streamMeta, statusLabel,
  computeWaste, benchmarkVerdict, closurePlan,
} from '../business/waste-engine.js'
import { renderOptimasi } from './optimasi-panel.js'

const { el, icon } = C
const TABS = [
  { value: 'pemborosan', label: 'Pemborosan' },
  { value: 'tindakan', label: 'Tindakan' },
  { value: 'optimasi', label: 'Ruang optimasi' },
]
let currentTab = 'pemborosan'

const STATUS_TONE = { open: 'danger', progress: 'warn', done: 'ok' }

/* ------------------------------------------------------------- Database */

async function fetchEntries() {
  const { data, error } = await getCloud().database.from('waste_entries').select('*')
  if (error) throw new Error(error.message)
  return (data || []).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

async function saveEntry(fields, id) {
  const loss = Number(fields.monthly_loss) || 0
  const saved = Math.min(loss, Number(fields.saved) || 0)
  const row = {
    stream: fields.stream || 'waktu',
    title: String(fields.title || '').trim(),
    detail: String(fields.detail || '').trim() || null,
    monthly_loss: loss,
    saved,
    action: String(fields.action || '').trim() || null,
    owner: String(fields.owner || '').trim() || null,
    status: fields.status || 'open',
  }
  if (row.status === 'done') row.saved = loss
  const table = getCloud().database.from('waste_entries')
  const { error } = id ? await table.update(row).eq('id', id) : await table.insert(row)
  if (error) throw new Error(error.message)
  notifyDataChanged()
}

async function removeEntry(id) {
  const { error } = await getCloud().database.from('waste_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
  notifyDataChanged()
}

async function closeEntry(entry) {
  const { error } = await getCloud().database.from('waste_entries')
    .update({ saved: Number(entry.monthly_loss) || 0, status: 'done' })
    .eq('id', entry.id)
  if (error) throw new Error(error.message)
  notifyDataChanged()
}

/* ---------------------------------------------------------------- Render */

export async function render(container, ctx = {}) {
  let model = null
  let entries = []
  const status = C.message()

  const host = el('div')
  const tabs = C.segmented({
    options: TABS, value: currentTab, label: 'Tanpa limbah',
    onChange: (value) => { currentTab = value; status.hide(); draw() },
  })
  tabs.classList.add('workspace-tabs')

  container.replaceChildren(
    C.pageHeader({
      title: 'Bebas limbah', em: 'limbah',
      actions: C.button({ label: 'Catat temuan', icon: 'plus', variant: 'primary', size: 'sm', onClick: () => openEditor(null) }),
    }),
    tabs, status, host,
  )

  const revenue = () => (model?.ledger || [])
    .filter((l) => l.category === 'pendapatan')
    .reduce((s, l) => s + (Number(l.amount) || 0), 0)

  function draw() {
    if (currentTab === 'pemborosan') drawState()
    else if (currentTab === 'tindakan') drawActions()
    else drawOptimasi()
  }

  /* ---------------------------------------------------------- Pemborosan */

  function drawState() {
    const w = computeWaste(entries, revenue())
    const plan = closurePlan(w)
    const freePct = Math.round(w.pct)

    const ring = el('div', { className: 'zw-ring' })
    const R = 54
    const CIRC = 2 * Math.PI * R
    const offset = CIRC * (1 - Math.min(1, w.pct / 100))
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 128 128')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', `Bebas limbah ${freePct} persen`)
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    track.setAttribute('cx', '64'); track.setAttribute('cy', '64'); track.setAttribute('r', String(R))
    track.setAttribute('class', 'zw-ring-track')
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    arc.setAttribute('cx', '64'); arc.setAttribute('cy', '64'); arc.setAttribute('r', String(R))
    arc.setAttribute('class', 'zw-ring-arc')
    arc.setAttribute('stroke-dasharray', String(CIRC))
    arc.setAttribute('stroke-dashoffset', String(offset))
    svg.append(track, arc)
    ring.append(svg, el('div', { className: 'zw-ring-label' },
      el('span', { className: 'zw-ring-value tnum' }, `${freePct}%`),
      el('span', { className: 'zw-ring-caption' }, 'bebas limbah')))

    const hero = el('div', { className: 'zw-hero' },
      ring,
      el('div', { className: 'zw-hero-body' },
        el('h2', { className: 'zw-hero-title' }, freePct >= 100
          ? 'Tidak ada kerugian tercatat yang tersisa'
          : `${C.rupiah(w.remaining)} masih bocor setiap bulan`),
        el('p', { className: 'zw-hero-text' }, w.loss
          ? `Dari ${C.rupiah(w.loss)} kerugian yang pernah Anda catat, ${C.rupiah(w.saved)} sudah dihentikan. Sisa ${w.remaining > 0 ? `${C.rupiah(w.remaining)}` : 'nol'} sama dengan ${w.lossShare.toFixed(1)}% dari pendapatan tercatat.`
          : 'Belum ada kerugian yang dicatat. Catat satu temuan pertama supaya target 100% bebas limbah punya titik awal yang jujur.'),
        el('div', { className: 'zw-hero-actions' },
          C.button({ label: 'Catat temuan', icon: 'plus', variant: 'primary', size: 'sm', onClick: () => openEditor(null) }),
          C.button({ label: 'Lihat tindakan', iconRight: 'arrowRight', size: 'sm', variant: 'ghost', onClick: () => tabs.querySelector('[data-value="tindakan"]')?.click() })),
      ),
    )

    const kpis = el('div', { className: 'zw-kpis' },
      C.kpi({ label: 'Sisa kerugian', value: C.rupiah(w.remaining), sub: `${w.lossShare.toFixed(1)}% dari pendapatan`, iconName: 'trendingDown' }),
      C.kpi({ label: 'Sudah dihentikan', value: C.rupiah(w.saved), sub: `dari ${C.rupiah(w.loss)} tercatat`, iconName: 'checkCircle' }),
      C.kpi({ label: 'Masih bisa dihemat', value: C.rupiah(w.winnable), sub: `${w.open} temuan terbuka`, iconName: 'target' }),
      C.kpi({ label: 'Temuan selesai', value: String(w.done), sub: 'sudah ditutup', iconName: 'flag' }),
    )

    const streamCards = el('div', { className: 'zw-streams' }, w.streams.map((s) => {
      const verdict = benchmarkVerdict(s, revenue())
      return el('article', { className: 'zw-stream', 'data-tone': verdict.tone },
        el('header', { className: 'zw-stream-head' },
          el('span', { className: 'zw-stream-ico', 'aria-hidden': 'true' }, icon(s.icon, { size: 18 })),
          el('div', { className: 'zw-stream-id' },
            el('h3', { className: 'zw-stream-name' }, s.short),
            el('p', { className: 'zw-stream-sub' }, `${s.rows.length} temuan · ${s.open} terbuka`),
          ),
          C.tag(verdict.label, verdict.tone),
        ),
        el('div', { className: 'zw-stream-money' },
          el('span', { className: 'zw-stream-money-value tnum' }, C.rupiah(s.remaining)),
          el('span', { className: 'zw-stream-money-label' }, 'sisa / bulan'),
        ),
        el('div', { className: 'zw-bar', role: 'img', 'aria-label': `Terhentikan ${Math.round(s.pct)} persen` },
          el('span', { className: 'zw-bar-fill', style: `width:${Math.max(0, Math.min(100, s.pct))}%` })),
        el('div', { className: 'zw-stream-foot' },
          el('span', { className: 'tnum' }, `${Math.round(s.pct)}% terhenti`),
          el('span', { className: 'tnum' }, `patokan ${s.benchmark}% pendapatan`),
        ),
        el('p', { className: 'zw-stream-why' }, s.why),
      )
    }))

    const planPanel = plan.length
      ? C.panel({ title: 'Jalan terpendek menuju nol', meta: 'Diurutkan dari kebocoran terbesar' },
        el('ol', { className: 'zw-plan' }, plan.map((p) => el('li', { className: 'zw-plan-item' },
          el('div', { className: 'zw-plan-head' },
            el('span', { className: 'zw-plan-name' }, p.label),
            el('span', { className: 'zw-plan-value tnum' }, C.rupiah(p.remaining))),
          el('p', { className: 'zw-plan-action' }, p.action),
          el('div', { className: 'zw-bar is-thin', role: 'img', 'aria-label': `Terhentikan ${Math.round(p.pct)} persen` },
            el('span', { className: 'zw-bar-fill', style: `width:${Math.max(0, Math.min(100, p.pct))}%` })),
        ))))
      : C.panel({ title: 'Jalan terpendek menuju nol' },
        el('p', { className: 'zw-muted' }, 'Semua stream sudah bersih. Pertahankan dengan pemeriksaan bulanan.'))

    host.replaceChildren(hero, kpis, streamCards, planPanel)
  }

  /* ------------------------------------------------------------ Tindakan */

  function drawActions() {
    const w = computeWaste(entries, revenue())
    const toolbar = el('div', { className: 'zw-toolbar' },
      C.button({ label: 'Catat temuan', icon: 'plus', variant: 'primary', size: 'sm', onClick: () => openEditor(null) }),
      C.button({ label: 'Impor massal', icon: 'layers', size: 'sm', onClick: openBulk }),
      el('span', { className: 'zw-toolbar-note' }, `${entries.length} temuan · ${w.open} terbuka · ${C.rupiah(w.winnable)} bisa dihemat`),
    )

    const body = entries.length
      ? C.dataTable({
        caption: 'Temuan pemborosan dan tindakannya',
        columns: [
          { key: 'title', label: 'Temuan', render: (r) => C.cellStack(r.title, el('span', { className: 'zw-clamp' }, r.detail || streamMeta(r.stream).label)) },
          { key: 'stream', label: 'Sumber', render: (r) => streamMeta(r.stream).short },
          { key: 'monthly_loss', label: 'Kerugian/bln', align: 'right', render: (r) => C.rupiah(r.monthly_loss) },
          { key: 'saved', label: 'Terhenti', align: 'right', render: (r) => C.rupiah(r.saved) },
          {
            key: 'remaining', label: 'Sisa', align: 'right',
            render: (r) => {
              const left = Math.max(0, (Number(r.monthly_loss) || 0) - (Number(r.saved) || 0))
              return el('strong', { className: `tnum ${left > 0 ? 'zw-left' : ''}` }, C.rupiah(left))
            },
          },
          { key: 'owner', label: 'Pemilik', render: (r) => r.owner || el('span', { className: 'muted' }, '—') },
          { key: 'status', label: 'Status', render: (r) => C.tag(statusLabel(r.status), STATUS_TONE[r.status] || 'neutral') },
          {
            key: 'act', label: '', className: 'zw-row-actions',
            render: (r) => el('div', { className: 'zw-row-actions-in' },
              r.status !== 'done'
                ? C.iconButton({ iconName: 'check', label: `Tandai selesai: ${r.title}`, onClick: () => markDone(r) })
                : null,
              C.iconButton({ iconName: 'pencil', label: `Ubah ${r.title}`, onClick: () => openEditor(r) }),
              C.iconButton({ iconName: 'trash', label: `Hapus ${r.title}`, onClick: () => confirmDelete(r) })),
          },
        ],
        rows: entries,
      })
      : C.emptyState({
        kicker: 'Belum ada temuan',
        title: 'Mulai dari kebocoran yang paling Anda rasakan',
        body: 'Contoh: teknisi menunggu bahan 45 menit per pekerjaan, atau kunjungan ulang karena noda tidak hilang. Setiap temuan butuh angka kerugian per bulan.',
        iconName: 'sprout',
        action: C.button({ label: 'Catat temuan pertama', icon: 'plus', variant: 'primary', onClick: () => openEditor(null) }),
      })

    host.replaceChildren(toolbar, body)
  }

  /* ------------------------------------------------------------ Optimasi */

  function drawOptimasi() {
    const rev = revenue()
    const w = computeWaste(entries, rev)
    const plan = closurePlan(w)
    const top = [...w.streams].sort((a, b) => b.remaining - a.remaining)

    const context = [
      'Cakupan: Tanpa limbah (zero waste)',
      `Pendapatan tercatat: ${C.rupiah(rev)}`,
      `Kerugian tercatat: ${C.rupiah(w.loss)} per bulan`,
      `Sudah dihentikan: ${C.rupiah(w.saved)} (${w.pct.toFixed(1)}%)`,
      `Sisa kerugian: ${C.rupiah(w.remaining)} (${w.lossShare.toFixed(1)}% dari pendapatan)`,
      `Temuan terbuka: ${w.open}, selesai: ${w.done}`,
      `Masih bisa dihemat: ${C.rupiah(w.winnable)}`,
      `Sumber terbesar: ${top[0]?.remaining > 0 ? top[0].label : 'Tidak ada'}`,
      'Rincian per sumber:',
      ...w.streams.map((s) => `- ${s.label}: sisa ${C.rupiah(s.remaining)}, terhenti ${Math.round(s.pct)}%, patokan sehat ${s.benchmark}% dari pendapatan`),
      ...plan.map((p) => `- Langkah disarankan untuk ${p.label}: ${p.action}`),
    ].join('\n')

    const facts = [
      { label: 'Pendapatan', value: C.rupiah(rev) },
      { label: 'Kerugian tercatat', value: `${C.rupiah(w.loss)}/bln` },
      { label: 'Sisa kerugian', value: `${C.rupiah(w.remaining)}/bln` },
      { label: 'Sudah terhenti', value: `${w.pct.toFixed(0)}%` },
      { label: 'Temuan terbuka', value: String(w.open) },
      { label: 'Sumber terbesar', value: top[0]?.remaining > 0 ? top[0].short : 'Tidak ada' },
    ]

    const presets = [
      {
        label: 'Hentikan kunjungan ulang',
        problem: 'Pekerjaan ulang dan panggilan balik memakan biaya. Saya ingin menekan angka ini sampai nol tanpa memperlambat tim.',
        target: 1500000,
      },
      {
        label: 'Rapikan rute & bahan bakar',
        problem: 'Biaya perjalanan naik karena jadwal tidak diurutkan. Saya ingin menghemat bahan bakar dan jam kerja yang hilang di jalan.',
        target: 800000,
      },
      {
        label: 'Target 100% bebas limbah',
        problem: 'Saya ingin menutup semua kebocoran yang tercatat dan mencapai nol kerugian bulanan dalam tiga bulan.',
        target: Math.max(500000, Math.round(w.remaining / 3 / 50000) * 50000),
      },
    ]

    renderOptimasi(host, ctx, { scope: 'waste', context, facts, presets })
  }

  /* --------------------------------------------------------------- Modals */

  function openEditor(existing) {
    const isEdit = Boolean(existing)
    const seed = existing || {}
    const stream = C.select({
      label: 'Sumber pemborosan', id: 'zw-stream',
      options: WASTE_STREAMS.map((s) => ({ value: s.key, label: s.label })),
      value: seed.stream || 'waktu',
      hint: 'Pilih satu sumber supaya laporan tidak tercampur.',
    })
    const title = C.field({ label: 'Apa yang bocor', id: 'zw-title', required: true, value: seed.title || '', placeholder: 'Contoh: Teknisi menunggu bahan di gudang' })
    const detail = C.textarea({ label: 'Bagaimana hal itu terjadi', id: 'zw-detail', rows: 3, value: seed.detail || '', placeholder: 'Kapan, di mana, dan seberapa sering.' })
    const loss = C.field({ label: 'Kerugian per bulan (Rp)', id: 'zw-loss', type: 'number', required: true, value: seed.monthly_loss ?? '', hint: 'Perkiraan yang jujur lebih berguna daripada angka yang terlihat bagus.', attrs: { min: '0', step: '50000', inputmode: 'numeric' } })
    const saved = C.field({ label: 'Sudah dihentikan per bulan (Rp)', id: 'zw-saved', type: 'number', value: seed.saved ?? 0, hint: 'Isi nol bila belum ada yang dikerjakan.', attrs: { min: '0', step: '50000', inputmode: 'numeric' } })
    const action = C.textarea({ label: 'Tindakan', id: 'zw-action', rows: 2, value: seed.action || '', placeholder: 'Apa yang akan atau sudah dilakukan.' })
    const owner = C.field({ label: 'Pemilik tindakan', id: 'zw-owner', value: seed.owner || '', placeholder: 'Contoh: Tim Operasional' })
    const statusSel = C.select({ label: 'Status', id: 'zw-status', options: WASTE_STATUSES, value: seed.status || 'open' })

    const saveBtn = C.button({ label: isEdit ? 'Simpan perubahan' : 'Catat temuan', variant: 'primary' })
    const modalNote = C.message()
    const dialog = C.modal({
      title: isEdit ? 'Ubah temuan' : 'Temuan pemborosan baru',
      description: 'Satu temuan = satu kebocoran dengan angka dan pemilik. Ini yang membuat target 100% bisa diukur.',
      wide: true,
      children: [
        modalNote,
        el('div', { className: 'zw-form-grid' }, stream.wrap, statusSel.wrap),
        title.wrap,
        detail.wrap,
        el('div', { className: 'zw-form-grid' }, loss.wrap, saved.wrap),
        action.wrap,
        owner.wrap,
      ],
      actions: [C.button({ label: 'Batal', variant: 'ghost' }), saveBtn],
      opener: container,
    })

    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      modalNote.hide()
      if (!title.input.value.trim()) { title.input.focus(); modalNote.show('warn', 'Tulis dulu apa yang bocor.'); return }
      if (!(Number(loss.input.value) > 0)) { loss.input.focus(); modalNote.show('warn', 'Kerugian per bulan harus lebih dari nol.'); return }
      if (Number(saved.input.value) > Number(loss.input.value)) {
        saved.input.focus(); modalNote.show('warn', 'Yang sudah dihentikan tidak boleh melebihi kerugian tercatat.'); return
      }
      const restore = C.setBusy(saveBtn, 'Menyimpan…')
      try {
        await saveEntry({
          stream: stream.input.value, title: title.input.value, detail: detail.input.value,
          monthly_loss: loss.input.value, saved: saved.input.value,
          action: action.input.value, owner: owner.input.value, status: statusSel.input.value,
        }, existing?.id)
        dialog.close()
        status.hide()
        showToast(isEdit ? 'Temuan diperbarui.' : 'Temuan dicatat.', 'success')
        await reload()
      } catch (err) { modalNote.show('danger', err.message) } finally { restore() }
    })
  }

  async function markDone(entry) {
    try {
      await closeEntry(entry)
      showToast('Temuan ditutup, kerugian dihitung terhenti.', 'success')
      await reload()
    } catch (err) { status.show('danger', err.message) }
  }

  function confirmDelete(entry) {
    const delBtn = C.button({ label: 'Hapus', variant: 'danger' })
    const dialog = C.modal({
      title: 'Hapus temuan?',
      description: `"${entry.title}" akan dihapus dan tidak lagi dihitung dalam target bebas limbah.`,
      children: [el('p', { className: 'zw-muted' }, 'Tindakan ini tidak bisa dibatalkan.')],
      actions: [C.button({ label: 'Batal', variant: 'ghost' }), delBtn],
      opener: container,
    })
    delBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      const restore = C.setBusy(delBtn, 'Menghapus…')
      try {
        await removeEntry(entry.id)
        dialog.close()
        showToast('Temuan dihapus.', 'success')
        await reload()
      } catch (err) { status.show('danger', err.message) } finally { restore() }
    })
  }

  function openBulk() {
    const ta = C.textarea({
      label: 'Tempel data',
      id: 'zw-bulk',
      rows: 10,
      hint: 'JSON array, atau satu baris per temuan: sumber | judul | kerugian | terhenti | pemilik | status. Sumber: waktu, perjalanan, bahan, pengerjaan_ulang, air_kimia.',
      placeholder: 'perjalanan | Rute tidak diurutkan antar kecamatan | 900000 | 0 | Tim Operasional | open\nbahan | Dosis kimia berlebih pada kolam kecil | 400000 | 150000 | Tim Operasional | progress',
    })
    const preview = el('div', { className: 'zw-bulk-preview' })
    const check = () => {
      try {
        const rows = parseBulk(ta.input.value)
        preview.className = 'zw-bulk-preview is-ok'
        preview.textContent = `${rows.length} temuan siap diimpor. Contoh: ${rows[0].title} — ${C.rupiah(rows[0].monthly_loss)}`
      } catch (err) {
        preview.className = 'zw-bulk-preview is-bad'
        preview.textContent = err.message
      }
    }
    ta.input.addEventListener('input', check)

    const importBtn = C.button({ label: 'Impor', variant: 'primary' })
    const modalNote = C.message()
    const dialog = C.modal({
      title: 'Impor massal temuan',
      description: 'Tempel dari spreadsheet. Seluruh baris ditolak bila ada satu yang tidak valid, supaya hitungan tidak setengah jadi.',
      wide: true,
      children: [modalNote, ta.wrap, preview],
      actions: [C.button({ label: 'Batal', variant: 'ghost' }), importBtn],
      opener: container,
    })

    importBtn.addEventListener('click', async (e) => {
      e.preventDefault()
      modalNote.hide()
      let rows
      try { rows = parseBulk(ta.input.value) } catch (err) { modalNote.show('warn', err.message); return }
      const restore = C.setBusy(importBtn, 'Mengimpor…')
      try {
        const { error } = await getCloud().database.from('waste_entries').insert(rows)
        if (error) throw new Error(error.message)
        dialog.close()
        showToast(`${rows.length} temuan diimpor.`, 'success')
        notifyDataChanged()
        await reload()
      } catch (err) { modalNote.show('danger', err.message) } finally { restore() }
    })
  }

  /* ----------------------------------------------------------------- Load */

  async function reload() {
    try {
      const [m, list] = await Promise.all([loadFlow(), fetchEntries()])
      model = m
      entries = list
    } catch (err) {
      if (ctx.signal?.aborted) return
      status.show('danger', `Gagal memuat data: ${err.message}`)
      host.replaceChildren(C.errorState(err.message))
      return
    }
    if (ctx.signal?.aborted) return
    draw()
  }

  host.replaceChildren(C.skeletonRows(4))
  await reload()
}

/* --------------------------------------------------------------- Parsing */

const STREAM_ALIASES = {
  waktu: 'waktu', waktu_menganggur: 'waktu', idle: 'waktu',
  perjalanan: 'perjalanan', transport: 'perjalanan', bahan_bakar: 'perjalanan',
  bahan: 'bahan', material: 'bahan', consumables: 'bahan',
  pengerjaan_ulang: 'pengerjaan_ulang', rework: 'pengerjaan_ulang', kerja_ulang: 'pengerjaan_ulang',
  air_kimia: 'air_kimia', kimia: 'air_kimia', air: 'air_kimia',
}

function normalizeRow(r, lineNo) {
  const clean = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '')
  const title = clean(r.title ?? r.judul)
  if (!title) throw new Error(`Baris ${lineNo}: judul temuan wajib diisi.`)
  const loss = Number(String(r.monthly_loss ?? r.kerugian ?? '').replace(/[^\d]/g, ''))
  if (!(loss > 0)) throw new Error(`Baris ${lineNo}: kerugian per bulan harus lebih dari nol.`)
  const streamRaw = clean(r.stream ?? r.sumber).toLowerCase().replace(/\s+/g, '_')
  const stream = STREAM_ALIASES[streamRaw] || 'waktu'
  const savedRaw = Number(String(r.saved ?? r.terhenti ?? 0).replace(/[^\d]/g, '')) || 0
  const statusRaw = clean(r.status ?? 'open').toLowerCase()
  return {
    stream,
    title,
    detail: clean(r.detail ?? r.keterangan) || null,
    monthly_loss: loss,
    saved: Math.min(loss, savedRaw),
    action: clean(r.action ?? r.tindakan) || null,
    owner: clean(r.owner ?? r.pemilik) || null,
    status: ['open', 'progress', 'done'].includes(statusRaw) ? statusRaw : 'open',
  }
}

function parseBulk(text) {
  const raw = String(text || '').trim()
  if (!raw) throw new Error('Tidak ada data untuk diimpor.')
  if (raw.startsWith('[')) {
    let rows
    try { rows = JSON.parse(raw) } catch { throw new Error('JSON tidak valid. Periksa koma dan tanda kutip.') }
    if (!Array.isArray(rows)) throw new Error('JSON harus berupa daftar temuan.')
    return rows.map((r, i) => normalizeRow(r, i + 1))
  }
  return raw.split('\n')
    .map((line, i) => ({ line: line.trim(), i: i + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'))
    .map(({ line, i }) => {
      const p = line.split(/\s*[|\t;]\s*/)
      return normalizeRow({
        stream: p[0], title: p[1], monthly_loss: p[2], saved: p[3], owner: p[4], status: p[5],
      }, i)
    })
}
