export function IconButton({ label, title, onClick, disabled, danger, className, children }) {
  return (
    <button
      type="button"
      className={`btn btn-icon${danger ? " danger" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title || label}
    >
      {children}
    </button>
  );
}

export function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.5 3.2c0-.9 1-.4 1-.4l6.8 4.3c.6.4.6 1.2 0 1.6L5.5 13c0 0-1 .5-1-.4V3.2z" fill="currentColor" />
    </svg>
  );
}

export function SpinnerIcon() {
  return (
    <svg className="btn-icon-spinner" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="18 20" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.5 2.5v3h-3M3.5 13.5v-3h3" />
      <path d="M3.4 5.6a5 5 0 0 1 8.3-1.8M12.6 10.4a5 5 0 0 1-8.3 1.8" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M6 2.5h4l.5.5H13v1H3V3h2.5l.5-.5zM4 5h8l-.7 7.1a1 1 0 0 1-1 .9H5.7a1 1 0 0 1-1-.9L4 5zm2.2 1.5v5h1.1v-5H6.2zm2.5 0v5h1.1v-5H8.7z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RunIconButton({ testName, running, disabled, onClick }) {
  const name = testName || "test case";
  return (
    <IconButton
      label={running ? `Running ${name}` : `Run ${name}`}
      title={running ? "Running…" : "Run"}
      onClick={onClick}
      disabled={disabled}
    >
      {running ? <SpinnerIcon /> : <PlayIcon />}
    </IconButton>
  );
}
