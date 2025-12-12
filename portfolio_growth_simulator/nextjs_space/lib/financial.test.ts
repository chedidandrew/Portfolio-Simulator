import { describe, it, expect } from 'vitest' // or jest

// Copy your calculation logic into a pure function for testing
function calculateNominalGrowth(
  principal: number,
  annualReturnPct: number,
  years: number,
  monthlyContrib: number,
  inflationPct: number
) {
  let balance = principal;
  let contribution = monthlyContrib;
  const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const inflationFactor = 1 + inflationPct / 100;

  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      balance = balance * (1 + monthlyRate) + contribution;
    }
    // Inflation hits at the start of the next year
    contribution *= inflationFactor;
  }
  return balance;
}

describe('Financial Logic', () => {
  it('calculates simple compound interest accurately', () => {
    // PV=10k, r=10%, t=10yr, PMT=0
    // Expected: 10000 * (1.10)^10 = 25937.42
    const result = calculateNominalGrowth(10000, 10, 10, 0, 0);
    expect(result).toBeCloseTo(25937.42, 1);
  });

  it('handles contributions without inflation', () => {
    // PV=0, r=0%, t=1yr, PMT=100
    // Expected: 1200
    const result = calculateNominalGrowth(0, 0, 1, 100, 0);
    expect(result).toBeCloseTo(1200, 2);
  });

  it('increases contributions with inflation', () => {
    // PV=0, r=0%, t=2yr, PMT=100, Inf=10%
    // Year 1: 100 * 12 = 1200
    // Year 2: 110 * 12 = 1320
    // Total: 2520
    const result = calculateNominalGrowth(0, 0, 2, 100, 10);
    expect(result).toBeCloseTo(2520, 2);
  });
});