import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import SubmittingOverlay from '../components/SubmittingOverlay';
import { useNotification } from './NotificationProvider';

const MutationContext = createContext(null);

export function MutationProvider({ children }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('Saving…');
  const notify = useNotification();

  const runMutation = useCallback(async ({
    mutation,
    refresh,
    successMessage = 'Changes saved successfully.',
    errorMessage,
    overlayMessage = 'Saving…',
    showSuccess = true,
  }) => {
    setMessage(overlayMessage);
    setActive(true);
    try {
      const result = await mutation();
      if (refresh) {
        await refresh();
      }
      if (showSuccess && successMessage) {
        notify.success(successMessage);
      }
      return { ok: true, result };
    } catch (err) {
      const msg = errorMessage || err?.message || 'Something went wrong. Please try again.';
      notify.error(msg);
      return { ok: false, error: err };
    } finally {
      setActive(false);
    }
  }, [notify]);

  const value = useMemo(() => ({ runMutation, isMutating: active }), [runMutation, active]);

  return (
    <MutationContext.Provider value={value}>
      {children}
      {active && (
        <div className="global-submitting-overlay">
          <SubmittingOverlay message={message} />
        </div>
      )}
    </MutationContext.Provider>
  );
}

export function useMutation() {
  const ctx = useContext(MutationContext);
  if (!ctx) {
    return {
      runMutation: async ({ mutation, refresh }) => {
        try {
          const result = await mutation();
          if (refresh) await refresh();
          return { ok: true, result };
        } catch (err) {
          window.alert(err?.message || 'Something went wrong.');
          return { ok: false, error: err };
        }
      },
      isMutating: false,
    };
  }
  return ctx;
}
