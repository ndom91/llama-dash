import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { DEFAULT_USAGE_PANELS, parseUsagePanelsSetting, UpdateUsagePanelSettingsBodySchema } from './usage'

describe('usage panel settings', () => {
  it('defaults to client, key and model when unset or invalid', () => {
    expect(DEFAULT_USAGE_PANELS).toEqual(['client', 'key', 'model'])
    expect(parseUsagePanelsSetting(null)).toEqual(DEFAULT_USAGE_PANELS)
    expect(parseUsagePanelsSetting('not json')).toEqual(DEFAULT_USAGE_PANELS)
    expect(parseUsagePanelsSetting('["client","model"]')).toEqual(DEFAULT_USAGE_PANELS)
    expect(parseUsagePanelsSetting('["client","model","nope"]')).toEqual(DEFAULT_USAGE_PANELS)
  })

  it('reads a stored selection', () => {
    expect(parseUsagePanelsSetting('["status","model","host"]')).toEqual(['status', 'model', 'host'])
  })

  it('validates update bodies', () => {
    const ok = v.safeParse(UpdateUsagePanelSettingsBodySchema, { panels: ['session', 'endUser', 'routing'] })
    expect(ok.success).toBe(true)
    expect(v.safeParse(UpdateUsagePanelSettingsBodySchema, { panels: ['session', 'endUser'] }).success).toBe(false)
    expect(v.safeParse(UpdateUsagePanelSettingsBodySchema, { panels: ['client', 'key', 'cost'] }).success).toBe(false)
    expect(v.safeParse(UpdateUsagePanelSettingsBodySchema, {}).success).toBe(false)
  })
})
