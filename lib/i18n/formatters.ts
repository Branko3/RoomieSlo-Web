import { intlLocale, TIME_ZONE, type Locale } from "./config";

export type Formatters = {
  /** "sl-SI" or "en-GB", for the rare formatter not listed here. */
  intlLocale: "sl-SI" | "en-GB";
  timeZone: string;
  /** Ljubljana calendar day of a moment: "20. 9. 2026" / "20/09/2026". */
  date: (value: Date | string | number) => string;
  /**
   * A `YYYY-MM-DD` calendar day (no time zone shift): "20. 9. 2026" /
   * "20/09/2026". Anything that is not an ISO date is returned unchanged.
   */
  calendarDate: (isoDay: string) => string;
  /** Day and time: "20. 9. 2026, 14:05" / "20/09/2026, 14:05". */
  dateTime: (value: Date | string | number) => string;
  /** Medium date with short time: "20. sep. 2026, 14:05" / "20 Sept 2026, 14:05". */
  dateTimeMedium: (value: Date | string | number) => string;
  /** Short date with short time: "20. 09. 26, 14:05" / "20/09/2026, 14:05". */
  dateTimeShort: (value: Date | string | number) => string;
  /** "14:05". */
  time: (value: Date | string | number) => string;
  /** Long day label: "ponedeljek, 21. september" / "Monday 21 September". */
  dayLabel: (value: Date | string | number) => string;
  /**
   * Euros: whole amounts without decimals, anything else with cents.
   * "320 €", "320,50 €", "12.000 €" / "€320", "€320.50", "€12,000".
   */
  currency: (amount: number) => string;
  /** Plain number with the locale's grouping and decimals. */
  number: (value: number) => string;
};

const cache = new Map<Locale, Formatters>();

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Locale-aware formatters in Ljubljana time, created once per locale. */
export function getFormatters(locale: Locale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;
  const tag = intlLocale(locale);
  const dateTime = (options: Intl.DateTimeFormatOptions) => {
    const formatter = new Intl.DateTimeFormat(tag, {
      timeZone: TIME_ZONE,
      ...options,
    });
    return (value: Date | string | number) => formatter.format(toDate(value));
  };
  const numeric = {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  } as const;
  const hourMinute = { hour: "2-digit", minute: "2-digit" } as const;
  const date = dateTime(numeric);
  const euros = (digits: number) =>
    new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const wholeEuros = euros(0);
  const eurosAndCents = euros(2);
  const number = new Intl.NumberFormat(tag);

  const formatters: Formatters = {
    intlLocale: tag,
    timeZone: TIME_ZONE,
    date,
    calendarDate: (isoDay) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
      if (!match) return isoDay;
      const [, year, month, day] = match.map(Number);
      // Noon UTC is the same calendar day in Ljubljana all year round.
      return date(Date.UTC(year, month - 1, day, 12));
    },
    dateTime: dateTime({ ...numeric, ...hourMinute }),
    dateTimeMedium: dateTime({ dateStyle: "medium", timeStyle: "short" }),
    dateTimeShort: dateTime({ dateStyle: "short", timeStyle: "short" }),
    time: dateTime(hourMinute),
    dayLabel: dateTime({ weekday: "long", day: "numeric", month: "long" }),
    currency: (amount) =>
      (Number.isInteger(amount) ? wholeEuros : eurosAndCents).format(amount),
    number: (value) => number.format(value),
  };
  cache.set(locale, formatters);
  return formatters;
}
