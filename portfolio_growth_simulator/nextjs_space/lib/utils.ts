import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function roundToCents(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export const UNITS = [
  { value: 1e303, suffix: 'Cn', name: 'Centillion' },
  
  // 90s - Nonagintillions
  { value: 1e300, suffix: 'Nng', name: 'Novemnonagintillion' }, { value: 1e297, suffix: 'Ong', name: 'Octononagintillion' }, { value: 1e294, suffix: 'Sng', name: 'Septennonagintillion' },
  { value: 1e291, suffix: 'Xng', name: 'Sexnonagintillion' }, { value: 1e288, suffix: 'Qng', name: 'Quinnonagintillion' }, { value: 1e285, suffix: 'Qtng', name: 'Quattuornonagintillion' },
  { value: 1e282, suffix: 'Tng', name: 'Trenonagintillion' }, { value: 1e279, suffix: 'Dng', name: 'Duononagintillion' }, { value: 1e276, suffix: 'Ung', name: 'Unnonagintillion' },
  { value: 1e273, suffix: 'Ng', name: 'Nonagintillion' }, 

  // 80s - Octogintillions
  { value: 1e270, suffix: 'Nog', name: 'Novemoctogintillion' }, { value: 1e267, suffix: 'Oog', name: 'Octooctogintillion' }, { value: 1e264, suffix: 'Sog', name: 'Septenoctogintillion' },
  { value: 1e261, suffix: 'Xog', name: 'Sexoctogintillion' }, { value: 1e258, suffix: 'Qog', name: 'Quinoctogintillion' }, { value: 1e255, suffix: 'Qtog', name: 'Quattuoroctogintillion' },
  { value: 1e252, suffix: 'Tog', name: 'Treoctogintillion' }, { value: 1e249, suffix: 'Dog', name: 'Duooctogintillion' }, { value: 1e246, suffix: 'Uog', name: 'Unoctogintillion' },
  { value: 1e243, suffix: 'Og', name: 'Octogintillion' },

  // 70s - Septuagintillions
  { value: 1e240, suffix: 'Nst', name: 'Novemseptuagintillion' }, { value: 1e237, suffix: 'Ost', name: 'Octoseptuagintillion' }, { value: 1e234, suffix: 'Sst', name: 'Septenseptuagintillion' },
  { value: 1e231, suffix: 'Xst', name: 'Sexseptuagintillion' }, { value: 1e228, suffix: 'Qst', name: 'Quinseptuagintillion' }, { value: 1e225, suffix: 'Qtst', name: 'Quattuorseptuagintillion' },
  { value: 1e222, suffix: 'Tst', name: 'Treseptuagintillion' }, { value: 1e219, suffix: 'Dst', name: 'Duoseptuagintillion' }, { value: 1e216, suffix: 'Ust', name: 'Unseptuagintillion' },
  { value: 1e213, suffix: 'St', name: 'Septuagintillion' },

  // 60s - Sexagintillions
  { value: 1e210, suffix: 'Nsg', name: 'Novemsexagintillion' }, { value: 1e207, suffix: 'Osg', name: 'Octosexagintillion' }, { value: 1e204, suffix: 'Ssg', name: 'Septensexagintillion' },
  { value: 1e201, suffix: 'Xsg', name: 'Sexsexagintillion' }, { value: 1e198, suffix: 'Qsg', name: 'Quinsexagintillion' }, { value: 1e195, suffix: 'Qtsg', name: 'Quattuorsexagintillion' },
  { value: 1e192, suffix: 'Tsg', name: 'Tresexagintillion' }, { value: 1e189, suffix: 'Dsg', name: 'Duosexagintillion' }, { value: 1e186, suffix: 'Usg', name: 'Unsexagintillion' },
  { value: 1e183, suffix: 'Sg', name: 'Sexagintillion' },

  // 50s - Quinquagintillions
  { value: 1e180, suffix: 'Nqq', name: 'Novemquinquagintillion' }, { value: 1e177, suffix: 'Oqq', name: 'Octoquinquagintillion' }, { value: 1e174, suffix: 'Sqq', name: 'Septenquinquagintillion' },
  { value: 1e171, suffix: 'Xqq', name: 'Sexquinquagintillion' }, { value: 1e168, suffix: 'Qqq', name: 'Quinquinquagintillion' }, { value: 1e165, suffix: 'Qtqq', name: 'Quattuorquinquagintillion' },
  { value: 1e162, suffix: 'Tqq', name: 'Trequinquagintillion' }, { value: 1e159, suffix: 'Dqq', name: 'Duoquinquagintillion' }, { value: 1e156, suffix: 'Uqq', name: 'Unquinquagintillion' },
  { value: 1e153, suffix: 'Qq', name: 'Quinquagintillion' },

  // 40s - Quadragintillions
  { value: 1e150, suffix: 'Nqd', name: 'Novemquadragintillion' }, { value: 1e147, suffix: 'Oqd', name: 'Octoquadragintillion' }, { value: 1e144, suffix: 'Sqd', name: 'Septenquadragintillion' },
  { value: 1e141, suffix: 'Xqd', name: 'Sexquadragintillion' }, { value: 1e138, suffix: 'Qqd', name: 'Quinquadragintillion' }, { value: 1e135, suffix: 'Qtqd', name: 'Quattuorquadragintillion' },
  { value: 1e132, suffix: 'Tqd', name: 'Trequadragintillion' }, { value: 1e129, suffix: 'Dqd', name: 'Duoquadragintillion' }, { value: 1e126, suffix: 'Uqd', name: 'Unquadragintillion' },
  { value: 1e123, suffix: 'Qd', name: 'Quadragintillion' },

  // 30s - Trigintillions
  { value: 1e120, suffix: 'Ntg', name: 'Novemtrigintillion' }, { value: 1e117, suffix: 'Otg', name: 'Octotrigintillion' }, { value: 1e114, suffix: 'Stg', name: 'Septentrigintillion' },
  { value: 1e111, suffix: 'Xtg', name: 'Sextrigintillion' }, { value: 1e108, suffix: 'Qtg', name: 'Quintrigintillion' }, { value: 1e105, suffix: 'Qttg', name: 'Quattuortrigintillion' },
  { value: 1e102, suffix: 'Ttg', name: 'Tretrigintillion' },

  { value: 1e100, suffix: 'Gg', name: 'Googol' }, // Googol (Special Case)

  // 20s & 10s & Units
  { value: 1e99,  suffix: 'Dtr', name: 'Duotrigintillion' },
  { value: 1e96,  suffix: 'Utr', name: 'Untrigintillion' },
  { value: 1e93,  suffix: 'Tg', name: 'Trigintillion' },
  { value: 1e90,  suffix: 'Nv', name: 'Novemvigintillion' },
  { value: 1e87,  suffix: 'Ov', name: 'Octovigintillion' },
  { value: 1e84,  suffix: 'Stv', name: 'Septenvigintillion' },
  { value: 1e81,  suffix: 'Sxv', name: 'Sexvigintillion' },
  { value: 1e78,  suffix: 'Qnv', name: 'Quinvigintillion' },
  { value: 1e75,  suffix: 'Qtv', name: 'Quattuorvigintillion' },
  { value: 1e72,  suffix: 'Tv', name: 'Trevigintillion' },
  { value: 1e69,  suffix: 'Dv', name: 'Duovigintillion' },
  { value: 1e66,  suffix: 'Uv', name: 'Unvigintillion' },
  { value: 1e63,  suffix: 'Vg', name: 'Vigintillion' },
  { value: 1e60,  suffix: 'Nd', name: 'Novemdecillion' },
  { value: 1e57,  suffix: 'Od', name: 'Octodecillion' },
  { value: 1e54,  suffix: 'Sd', name: 'Septendecillion' },
  { value: 1e51,  suffix: 'Sx', name: 'Sexdecillion' },
  { value: 1e48,  suffix: 'Qd', name: 'Quindecillion' },
  { value: 1e45,  suffix: 'Qt', name: 'Quattuordecillion' },
  { value: 1e42,  suffix: 'Td', name: 'Tredecillion' },
  { value: 1e39,  suffix: 'Dd', name: 'Duodecillion' },
  { value: 1e36,  suffix: 'Ud', name: 'Undecillion' },
  { value: 1e33,  suffix: 'De', name: 'Decillion' },
  { value: 1e30,  suffix: 'No', name: 'Nonillion' },
  { value: 1e27,  suffix: 'Oc', name: 'Octillion' },
  { value: 1e24,  suffix: 'Sp', name: 'Septillion' },
  { value: 1e21,  suffix: 'Sx', name: 'Sextillion' },
  { value: 1e18,  suffix: 'Qi', name: 'Quintillion' },
  { value: 1e15,  suffix: 'Q', name: 'Quadrillion' },
  { value: 1e12,  suffix: 'T', name: 'Trillion' },
  { value: 1e9,   suffix: 'B', name: 'Billion' },
  { value: 1e6,   suffix: 'M', name: 'Million' },
  { value: 1e3,   suffix: 'k', name: 'Thousand' },
]

/**
 * Returns the full descriptive name for a number > 1 million,
 * e.g. "1.50 Quinquagintillion"
 */
export function getLargeNumberName(value: number | undefined | null): string | null {
  if (value === undefined || value === null) return null
  const absValue = Math.abs(value)
  
  // Only apply past a million
  if (absValue < 1e6) return null

  for (const unit of UNITS) {
    if (absValue >= unit.value) {
      // Don't show tooltip for just Thousand (filtered by < 1e6 check above effectively, but explicit logic:
      // The prompt said "Apply this only past a million". 1e6 is Million. 
      // If we are at 1e6, we show Million.
      return `${(absValue / unit.value).toFixed(2)} ${unit.name}`
    }
  }
  return null
}

/**
 * UPDATED: Fully populated units list to prevent massive prefixes.
 * Covers every 10^3 step from Thousand to Centillion.
 */
export function formatCurrency(
  value: number | undefined | null,
  showDollarSign: boolean = true,
  decimals: number = 2,
  compact: boolean = true
): string {
  if (value === undefined || value === null) {
    return showDollarSign ? '$0' : '0'
  }

  // Handle Infinity
  if (!Number.isFinite(value)) {
     if (Number.isNaN(value)) return 'NaN';
     const sign = value < 0 ? '-' : '';
     const symbol = '∞'; 
     return showDollarSign ? `${sign}$${symbol}` : `${sign}${symbol}`;
  }

  const absValue = Math.abs(value)
  
  if (compact) {
    for (const unit of UNITS) {
      if (absValue >= unit.value) {
        const sign = value < 0 ? '-' : ''
        const dollarSign = showDollarSign ? '$' : ''
        return `${sign}${dollarSign}${(absValue / unit.value).toFixed(decimals)}${unit.suffix}`
      }
    }
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 0 : 2, 
    minimumFractionDigits: compact ? 0 : 2,
  })
  
  let formatted = formatter.format(value)
  
  if (!showDollarSign) {
      formatted = formatted.replace('$', '')
  }
  
  return formatted
}

export function formatCompactNumber(value: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}