export function PortraitPlaceholder({ label }: { label: string }) {
  return (
    <div className="portrait-placeholder">
      <span className="eyebrow">FC ORDABASY</span>
      <svg viewBox="0 0 160 180" aria-hidden="true">
        <circle cx="80" cy="57" r="29" />
        <path d="M25 164v-20a55 55 0 0 1 110 0v20Z" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
