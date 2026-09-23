import { useEffect, useRef, useState } from "react";

export default function ItemPicker({
  items,
  selectedId,
  triggerId,
  ariaLabel,
  emptyTrigger = "None",
  emptyList = "Nothing yet",
  newLabel = "New…",
  showDelete = true,
  onSelect,
  onEdit,
  onDelete,
  onCreate
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = (items || []).find((item) => item.id === selectedId);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeThen(action) {
    setOpen(false);
    action();
  }

  return (
    <div className="item-picker" ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        className="item-picker-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
      >
        {selected?.name || emptyTrigger}
      </button>
      {open ? (
        <div className="item-picker-panel" role="listbox" aria-label={ariaLabel}>
          {(items || []).length ? (
            items.map((item) => (
              <div
                key={item.id}
                className={`item-picker-row ${item.id === selectedId ? "active" : ""}`}
                role="option"
                aria-selected={item.id === selectedId}
              >
                <button
                  type="button"
                  className="item-picker-name"
                  onClick={() => closeThen(() => onSelect(item.id))}
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => closeThen(() => onEdit(item))}
                >
                  Edit
                </button>
                {showDelete ? (
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => closeThen(() => onDelete(item))}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="item-picker-empty">{emptyList}</div>
          )}
          <button
            type="button"
            className="item-picker-new"
            onClick={() => closeThen(onCreate)}
          >
            {newLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
