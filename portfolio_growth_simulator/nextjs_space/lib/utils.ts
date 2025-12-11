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
    // Ordered from largest to smallest
    const units = [
      { value: 1e303, suffix: 'Cn' },  // Centillion
      
      // 90s - Nonagintillions
      { value: 1e300, suffix: 'Nng' }, { value: 1e297, suffix: 'Ong' }, { value: 1e294, suffix: 'Sng' },
      { value: 1e291, suffix: 'Xng' }, { value: 1e288, suffix: 'Qng' }, { value: 1e285, suffix: 'Qtng' },
      { value: 1e282, suffix: 'Tng' }, { value: 1e279, suffix: 'Dng' }, { value: 1e276, suffix: 'Ung' },
      { value: 1e273, suffix: 'Ng' },  // Nonagintillion

      // 80s - Octogintillions
      { value: 1e270, suffix: 'Nog' }, { value: 1e267, suffix: 'Oog' }, { value: 1e264, suffix: 'Sog' },
      { value: 1e261, suffix: 'Xog' }, { value: 1e258, suffix: 'Qog' }, { value: 1e255, suffix: 'Qtog' },
      { value: 1e252, suffix: 'Tog' }, { value: 1e249, suffix: 'Dog' }, { value: 1e246, suffix: 'Uog' },
      { value: 1e243, suffix: 'Og' },  // Octogintillion

      // 70s - Septuagintillions
      { value: 1e240, suffix: 'Nst' }, { value: 1e237, suffix: 'Ost' }, { value: 1e234, suffix: 'Sst' },
      { value: 1e231, suffix: 'Xst' }, { value: 1e228, suffix: 'Qst' }, { value: 1e225, suffix: 'Qtst' },
      { value: 1e222, suffix: 'Tst' }, { value: 1e219, suffix: 'Dst' }, { value: 1e216, suffix: 'Ust' },
      { value: 1e213, suffix: 'St' },  // Septuagintillion

      // 60s - Sexagintillions
      { value: 1e210, suffix: 'Nsg' }, { value: 1e207, suffix: 'Osg' }, { value: 1e204, suffix: 'Ssg' },
      { value: 1e201, suffix: 'Xsg' }, { value: 1e198, suffix: 'Qsg' }, { value: 1e195, suffix: 'Qtsg' },
      { value: 1e192, suffix: 'Tsg' }, { value: 1e189, suffix: 'Dsg' }, { value: 1e186, suffix: 'Usg' },
      { value: 1e183, suffix: 'Sg' },  // Sexagintillion

      // 50s - Quinquagintillions
      { value: 1e180, suffix: 'Nqq' }, { value: 1e177, suffix: 'Oqq' }, { value: 1e174, suffix: 'Sqq' },
      { value: 1e171, suffix: 'Xqq' }, { value: 1e168, suffix: 'Qqq' }, { value: 1e165, suffix: 'Qtqq' },
      { value: 1e162, suffix: 'Tqq' }, { value: 1e159, suffix: 'Dqq' }, { value: 1e156, suffix: 'Uqq' },
      { value: 1e153, suffix: 'Qq' },  // Quinquagintillion

      // 40s - Quadragintillions
      { value: 1e150, suffix: 'Nqd' }, { value: 1e147, suffix: 'Oqd' }, { value: 1e144, suffix: 'Sqd' },
      { value: 1e141, suffix: 'Xqd' }, { value: 1e138, suffix: 'Qqd' }, { value: 1e135, suffix: 'Qtqd' },
      { value: 1e132, suffix: 'Tqd' }, { value: 1e129, suffix: 'Dqd' }, { value: 1e126, suffix: 'Uqd' },
      { value: 1e123, suffix: 'Qd' },  // Quadragintillion

      // 30s - Trigintillions
      { value: 1e120, suffix: 'Ntg' }, { value: 1e117, suffix: 'Otg' }, { value: 1e114, suffix: 'Stg' },
      { value: 1e111, suffix: 'Xtg' }, { value: 1e108, suffix: 'Qtg' }, { value: 1e105, suffix: 'Qttg' },
      { value: 1e102, suffix: 'Ttg' }, // Tretrigintillion

      { value: 1e100, suffix: 'Gg'  }, // Googol (Special Case)

      // 20s & 10s & Units
      { value: 1e99,  suffix: 'Dtr' }, // Duotrigintillion
      { value: 1e96,  suffix: 'Utr' }, // Untrigintillion
      { value: 1e93,  suffix: 'Tg'  }, // Trigintillion
      { value: 1e90,  suffix: 'Nv'  }, // Novemvigintillion
      { value: 1e87,  suffix: 'Ov'  }, // Octovigintillion
      { value: 1e84,  suffix: 'Stv' }, // Septenvigintillion
      { value: 1e81,  suffix: 'Sxv' }, // Sexvigintillion
      { value: 1e78,  suffix: 'Qnv' }, // Quinvigintillion
      { value: 1e75,  suffix: 'Qtv' }, // Quattuorvigintillion
      { value: 1e72,  suffix: 'Tv'  }, // Trevigintillion
      { value: 1e69,  suffix: 'Dv'  }, // Duovigintillion
      { value: 1e66,  suffix: 'Uv'  }, // Unvigintillion
      { value: 1e63,  suffix: 'Vg'  }, // Vigintillion
      { value: 1e60,  suffix: 'Nd'  }, // Novemdecillion
      { value: 1e57,  suffix: 'Od'  }, // Octodecillion
      { value: 1e54,  suffix: 'Sd'  }, // Septendecillion
      { value: 1e51,  suffix: 'Sx'  }, // Sexdecillion
      { value: 1e48,  suffix: 'Qd'  }, // Quindecillion
      { value: 1e45,  suffix: 'Qt'  }, // Quattuordecillion
      { value: 1e42,  suffix: 'Td'  }, // Tredecillion
      { value: 1e39,  suffix: 'Dd'  }, // Duodecillion
      { value: 1e36,  suffix: 'Ud'  }, // Undecillion
      { value: 1e33,  suffix: 'De'  }, // Decillion
      { value: 1e30,  suffix: 'No'  }, // Nonillion
      { value: 1e27,  suffix: 'Oc'  }, // Octillion
      { value: 1e24,  suffix: 'Sp'  }, // Septillion
      { value: 1e21,  suffix: 'Sx'  }, // Sextillion
      { value: 1e18,  suffix: 'Qi'  }, // Quintillion
      { value: 1e15,  suffix: 'Q'   }, // Quadrillion
      { value: 1e12,  suffix: 'T'   }, // Trillion
      { value: 1e9,   suffix: 'B'   }, // Billion
      { value: 1e6,   suffix: 'M'   }, // Million
      { value: 1e3,   suffix: 'k'   }, // Thousand
    ]

    for (const unit of units) {
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