import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface UseConfirmReturn {
  confirmState: ConfirmState;
  requestConfirm: (message: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const noop = () => {};

export function useConfirm(): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Store the resolve function for the pending promise
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    setMessage("");
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setMessage("");
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const requestConfirm = useCallback(
    (msg: string): Promise<boolean> => {
      // If a dialog is already open, cancel it
      if (resolveRef.current) {
        resolveRef.current(false);
      }

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setMessage(msg);
        setIsOpen(true);
      });
    },
    [],
  );

  const confirmState: ConfirmState = {
    isOpen,
    message,
    onConfirm: isOpen ? handleConfirm : noop,
    onCancel: isOpen ? handleCancel : noop,
  };

  return { confirmState, requestConfirm };
}
