import RunIconButton, {
  ChangeHistoryIcon,
  IconButton,
  LastRunsIcon,
  TrashIcon
} from "./RunIconButton";

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11.1 2.3a1.2 1.2 0 0 1 1.7 0l1 1a1.2 1.2 0 0 1 0 1.7L6.2 12.6 3 13.5l.9-3.2 7.2-7.2zM5.4 11.1l6-6 .5.5-6 6-.9.3.4-.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M5.5 2.5h6A1.5 1.5 0 0 1 13 4v7.5H11V4H5.5V2.5zM3 5.5h6A1.5 1.5 0 0 1 10.5 7v6.5A1.5 1.5 0 0 1 9 15H3a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 3 5.5zm0 1.5v6.5h6V7H3z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function SavedCaseActions({
  testName,
  running,
  runDisabled,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
  onLastRuns,
  onChangeHistory
}) {
  const name = testName || "test case";

  return (
    <div className="inline-actions saved-case-actions">
      <RunIconButton
        testName={name}
        running={running}
        disabled={runDisabled}
        onClick={onRun}
      />
      <IconButton
        label={`Edit ${name}`}
        title="Edit"
        onClick={onEdit}
      >
        <PencilIcon />
      </IconButton>
      <IconButton
        label={`Duplicate ${name}`}
        title="Duplicate"
        onClick={onDuplicate}
      >
        <CopyIcon />
      </IconButton>
      <IconButton
        label={`Delete ${name}`}
        title="Delete"
        onClick={onDelete}
        danger
      >
        <TrashIcon />
      </IconButton>
      {onLastRuns ? (
        <IconButton
          label={`Last runs for ${name}`}
          title="Last runs"
          onClick={onLastRuns}
        >
          <LastRunsIcon />
        </IconButton>
      ) : null}
      {onChangeHistory ? (
        <IconButton
          label={`Change history for ${name}`}
          title="Audit log"
          onClick={onChangeHistory}
        >
          <ChangeHistoryIcon />
        </IconButton>
      ) : null}
    </div>
  );
}
