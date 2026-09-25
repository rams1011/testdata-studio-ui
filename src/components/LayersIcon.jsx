export default function LayersIcon({ size = 16, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M8 1.5 1 5v1l7 3.5 7-3.5V5L8 1.5zm0 5.5L1 9.5v1L8 14l7-3.5v-1L8 7zm0 2.3 4.8-2.4L8 4.8 3.2 7.1 8 9.3z"
      />
    </svg>
  );
}
