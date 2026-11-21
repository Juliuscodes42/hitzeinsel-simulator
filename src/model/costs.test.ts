import { describe, expect, test } from 'vitest'
import {
  DEFAULT_COST_SETTINGS,
  PV_YIELD_KWH_PER_M2,
  costBreakdown,
  costTable,
  fundingFor,
  yearlySavings,
} from './costs.ts'
import { generateDistrict } from './district.ts'
import { optimize } from './optimizer.ts'
import { DEFAULT_WEATHER } from './atmosphere.ts'

const settings = { ...DEFAULT_COST_SETTINGS, rainFee: 0, electricityPrice: 0 }

describe('Kosten über einen Zeitraum', () => {
  test('nur Baukosten: Förderung zieht den Anteil ab', () => {
    const build = { ...settings, basis: 'build' as const, funding: fundingFor('private') }
    expect(costBreakdown('greenRoof', build).total).toBeCloseTo(45 * 0.5, 8)
    expect(costBreakdown('coolRoof', build).total).toBe(35)
  })

  test('über 20 Jahre: Cool Roof wird zweimal gestrichen, dazu Pflege', () => {
    // Lebensdauer 10 Jahre, Pflege 0 €/m²·a
    expect(costBreakdown('coolRoof', settings)).toMatchObject({ builds: 2, total: 70 })
    // Gründach: einmal gebaut, 1 €/m² Pflege je Jahr
    expect(costBreakdown('greenRoof', settings).total).toBeCloseTo(45 + 20, 8)
  })

  test('Solarstrom und gesparte Regengebühr werden abgezogen', () => {
    const withValues = { ...settings, electricityPrice: 0.1, rainFee: 1 }
    expect(yearlySavings('pvCanopy', withValues)).toBeCloseTo(PV_YIELD_KWH_PER_M2 * 0.1, 6)
    // Mulde koppelt ihre Fläche ganz ab: Pflaster hatte Abflussbeiwert 0,9
    expect(yearlySavings('swale', withValues)).toBeCloseTo(0.9, 6)
    // Cool Roof ändert den Abfluss nicht
    expect(yearlySavings('coolRoof', withValues)).toBe(0)
  })

  test('eine Maßnahme, die sich selbst bezahlt, kostet für den Optimierer 1 €/m²', () => {
    const cheapPv = { ...settings, electricityPrice: 1 }
    expect(costBreakdown('pvCanopy', cheapPv).total).toBeLessThan(0)
    expect(costTable(cheapPv).pvCanopy).toBe(1)
  })
})

describe('Zielvorgabe', () => {
  const grid = generateDistrict({ sealing: 0.75, density: 0.35, seed: 7 })

  test('der Optimierer baut, bis das Ziel erreicht ist, und nicht mehr', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, 0, 'mean', undefined, 0.5)
    expect(proposal.reached).toBe(true)
    expect(proposal.coolingK).toBeGreaterThanOrEqual(0.5)
    expect(proposal.coolingK).toBeLessThan(0.6)
  })

  test('ein unerreichbares Ziel wird gemeldet', () => {
    const proposal = optimize(grid, DEFAULT_WEATHER, 0, 'mean', undefined, 50)
    expect(proposal.reached).toBe(false)
    expect(proposal.coolingK).toBeCloseTo(proposal.maxCoolingK, 6)
  })
})
