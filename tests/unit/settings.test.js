import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAgentPrompts, getAgentParams, getMcpConfig, render } from '../../src/stages/settings.js'

const AGENT_KEY = 'satualur_settings_agent'

beforeEach(() => {
  localStorage.clear()
})

describe('getAgentPrompts (default)', () => {
  it('berisi prompt penawaran dan laporan', () => {
    const prompts = getAgentPrompts()
    expect(prompts.offer.length).toBeGreaterThan(50)
    expect(prompts.offer).toMatch(/penawaran/i)
    expect(prompts.report.length).toBeGreaterThan(50)
    expect(prompts.report).toMatch(/laporan keuangan/i)
  })
})

describe('getAgentParams (default)', () => {
  it('temperature 0.7, maxTokens 2000, modelPreference auto', () => {
    expect(getAgentParams()).toEqual({
      temperature: 0.7,
      maxTokens: 2000,
      modelPreference: 'auto',
    })
  })
})

describe('getMcpConfig (default)', () => {
  it('whatsapp dan email non-aktif dengan nilai bawaan', () => {
    const cfg = getMcpConfig()
    expect(cfg.whatsapp.enabled).toBe(false)
    expect(cfg.whatsapp.wapilotEndpoint).toBe('https://api.wapilot.io/v1')
    expect(cfg.email.enabled).toBe(false)
    expect(cfg.email.smtpPort).toBe('587')
  })
})

describe('override dari localStorage', () => {
  it('agent params mengikuti nilai tersimpan, field lain tetap default', () => {
    localStorage.setItem(AGENT_KEY, JSON.stringify({ temperature: 0.2, maxTokens: 500 }))
    const params = getAgentParams()
    expect(params.temperature).toBe(0.2)
    expect(params.maxTokens).toBe(500)
    expect(params.modelPreference).toBe('auto')
  })

  it('prompt tersimpan menimpa default', () => {
    localStorage.setItem(AGENT_KEY, JSON.stringify({ offerPrompt: 'Prompt kustom toko bunga.' }))
    expect(getAgentPrompts().offer).toBe('Prompt kustom toko bunga.')
    // report tetap default
    expect(getAgentPrompts().report).toMatch(/laporan keuangan/i)
  })
})

describe('ketahanan terhadap data korup', () => {
  it('JSON korup kembali ke default tanpa throw', () => {
    localStorage.setItem(AGENT_KEY, '{ini bukan json')
    expect(() => getAgentParams()).not.toThrow()
    expect(getAgentParams().temperature).toBe(0.7)
  })
})

describe('render (smoke)', () => {
  it('membuat tiga tab tanpa error', () => {
    const container = document.createElement('div')
    expect(() => render(container)).not.toThrow()
    const tabs = container.querySelectorAll('.tab-group button')
    expect(tabs).toHaveLength(3)
    expect([...tabs].map((b) => b.textContent)).toEqual([
      'MCP Connectors',
      'Agent Skills',
      'WorkBuddy Cloud',
    ])
  })

  it('klik tab memindahkan panel aktif', () => {
    const container = document.createElement('div')
    render(container)
    const agentTab = [...container.querySelectorAll('.tab-group button')]
      .find((b) => b.textContent === 'Agent Skills')
    agentTab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(container.querySelector('.tab-group button.active').textContent).toBe('Agent Skills')
  })
})
