/** Home — stroked house (Lucide-style), sized for the toolbar. */
export default function HomeIcon({ size = 20, className }) {
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
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.75V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.75" />
    </svg>
  );
}
