import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext({ toast() {} });

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const value = useMemo(() => ({
    toast(text, isError) {
      setMessage({ text, isError: Boolean(isError) });
      window.setTimeout(() => setMessage(null), 3200);
    }
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <div className={`toast ${message.isError ? "error" : ""}`}>{message.text}</div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
