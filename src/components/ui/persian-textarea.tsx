"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

// The textarea twin of PersianInput. Same contract: display Persian digits,
// store ASCII. RTL by default; pass dir="ltr" for LTR-semantic content.

type Props = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  value: string;
  onChange: (value: string) => void;
};

export const PersianTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function PersianTextarea({ value, onChange, dir = "rtl", ...rest }, ref) {
    return (
      <textarea
        {...rest}
        ref={ref}
        dir={dir}
        value={toPersianDigits(value)}
        onChange={(e) => onChange(toEnglishDigits(e.target.value))}
      />
    );
  },
);