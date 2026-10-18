'use client';

import { useId } from 'react';

type Props = {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export default function PlannerToggle({ label, description, checked, disabled, onChange }: Props) {
  const descriptionId = useId();
  return (
    <label className={`flex min-h-16 items-center justify-between gap-4 rounded-lg px-3 py-3 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span id={descriptionId} className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" checked={checked} disabled={disabled}
          aria-label={label} aria-describedby={descriptionId}
          onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span aria-hidden="true" className="block h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-emerald-600 motion-reduce:transition-none" />
        <span aria-hidden="true" className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
    </label>
  );
}
