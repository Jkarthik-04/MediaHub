import type { FormEvent } from 'react';

export function SearchField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  onChange,
  onSubmit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="control-row" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      <button className="button button-primary" disabled={disabled} type="submit">
        {disabled ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
