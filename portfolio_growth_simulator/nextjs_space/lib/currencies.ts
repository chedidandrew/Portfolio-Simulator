import iso4217 from '@/data/iso4217.json'

export type CurrencyOption = {
  code: string
  symbol: string
  label: string
}

function getCurrencySymbol(code: string) {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)

    const cur = parts.find((p) => p.type === 'currency')?.value
    return cur || code
  } catch {
    return code
  }
}

export function getCurrencyOptions(): CurrencyOption[] {
  return (iso4217 as { code: string; name: string }[])
    .map(({ code, name }) => {
      const symbol = getCurrencySymbol(code)
      return { code, symbol, label: `${code} (${symbol}) - ${name}` }
    })
    .sort((a, b) => a.code.localeCompare(b.code))
}
