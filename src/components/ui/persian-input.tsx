"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { toEnglishDigits, toPersianDigits } from "@/lib/digits";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

export const PersianInput = forwardRef<HTMLInputElement, Props>(
  function PersianInput({ value, onChange, dir = "rtl", ...rest }, ref) {
    return (
      <input
        {...rest}
        ref={ref}
        dir={dir}
        value={toPersianDigits(value)}
        onChange={(e) => onChange(toEnglishDigits(e.target.value))}
      />
    );
  },
);