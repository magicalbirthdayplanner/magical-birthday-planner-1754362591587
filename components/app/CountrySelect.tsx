'use client'
import { COUNTRIES, selectableCountries, type CountryCode } from '@/lib/country/countries'

/**
 * Native country select (big touch target, the phone's own picker). Lists the selectable countries plus `value`, so
 * an existing party in a country that is not offered right now still shows its own country.
 */
export function CountrySelect({ label, value, onChange, id, hint, testId }: { label: string; value: CountryCode; onChange: (c: CountryCode) => void; id?: string; hint?: string; testId?: string }) {
  const options = Array.from(new Set([...selectableCountries(), value]))
  const inputId = id ?? `c-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        id={inputId}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        className="h-14 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15"
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {COUNTRIES[c].flag} {COUNTRIES[c].name}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
