/** Help — stroked circle with ? (Lucide-style), sized for the toolbar. */
export default function GuideIcon({ size = 20, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.25 9.5a2.75 2.75 0 0 1 5.35 1.1c0 1.85-2.85 2.55-2.85 3.65" />
      <path d="M12 17.5h.01" strokeWidth="2.5" />
    </svg>
  );
}
