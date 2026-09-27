export default function SearchIcon({ size = 16, className }) {
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
        d="M6.75 2a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zm0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM11.03 10.47a.75.75 0 0 1 1.06 1.06l2.72 2.72a.75.75 0 1 1-1.06 1.06l-2.72-2.72a.75.75 0 0 1 0-1.06z"
      />
    </svg>
  );
}
