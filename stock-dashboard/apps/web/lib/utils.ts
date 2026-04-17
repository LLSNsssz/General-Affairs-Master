import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSignedNumber(value: number, digits = 2) {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

  if (value > 0) {
    return `+${formatted}`;
  }

  if (value < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

export function formatPrice(value: number, currency: string) {
  if (!Number.isFinite(value)) {
    return `${currency}0`;
  }

  const digits = currency === "KRW" ? 0 : 2;
  return `${currency === "KRW" ? "₩" : "$"}${value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function average(numbers: number[]) {
  if (!numbers.length) {
    return 0;
  }

  return numbers.reduce((total, current) => total + current, 0) / numbers.length;
}
