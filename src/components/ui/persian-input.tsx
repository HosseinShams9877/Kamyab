"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { toEnglishDigits, toPersianDigits, formatThousands } from "@/lib/digits";

// A text input that DISPLAYS Persian digits and STORES ASCII digits.
//
// `dir="ltr"` (mobile, national-id, api-key, time): LTR layout, left-aligned,
// Persian glyphs. `dir="rtl"` (names, addresses, money): standard RTL flow.
//
// `thousandSeparator`: when true, the displayed value is grouped with commas
// every three digits (still Persian glyphs); the stored value on `onChange`
// stays pure ASCII digits with NO commas — so the server/schema never sees the
// separators. Use it for any money/amount field.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  thousandSeparator?: boolean;
};

export const PersianInput = forwardRef<HTMLInputElement, Props>(
  function PersianInput(
    { value, onChange, dir = "rtl", thousandSeparator = false, ...rest },
    ref,
  ) {
    const displayed = thousandSeparator
      ? toPersianDigits(formatThousands(value))
      : toPersianDigits(value);

    return (
      <input
        {...rest}
        ref={ref}
        dir={dir}
        value={displayed}
        onChange={(e) => {
          const raw = toEnglishDigits(e.target.value);
          const next = thousandSeparator ? raw.replace(/[^\d]/g, "") : raw;
          onChange(next);
        }}
      />
    );
  },
);