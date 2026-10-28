import { useCallback, useEffect, useRef, useState } from 'react';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_TIMEOUT_MS = 9 * 60 * 1000; // 9 minutes
const STORAGE_KEY = 'admin-inactivity';
const EXPIRED_MARKER_KEY = 'admin-session-expired';
const CHANNEL_NAME = 'admin-inactivity-channel';

type InactivityState = 'active'|'warning'|'expired';

interface InactivityStorage {
  lastActivity: number;
  userId: string | null;
  sessionToken: string | null;
}

export function useAdminInactivity(userId: string | null, sessionToken: string | null, onLogout: () => void) {
  const [state, setState] = useState<InactivityState>('active');
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onLogoutRef = useRef(onLogout);
  const userIdRef = useRef(userId);
  const sessionTokenRef = useRef(sessionToken);

  // Update refs when props change to avoid effect re-runs
  onLogoutRef.current = onLogout;
  userIdRef.current = userId;
  sessionTokenRef.current = sessionToken;

  const recordActivity = useCallback(() => {
    const now = Date.now();
    const currentUserId = userIdRef.current;
    const currentSessionToken = sessionTokenRef.current;
    
    // Check expiry before recording activity
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: InactivityStorage = JSON.parse(stored);
        if (data.userId === currentUserId && data.sessionToken === currentSessionToken) {
          const elapsed = now - data.lastActivity;
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            // Already expired, don't revive
            setState('expired');
            onLogoutRef.current();
            return;
          }
        }
      }
    } catch (e) {
      // Storage error, proceed
    }

    lastActivityRef.current = now;
    
    if (currentUserId && currentSessionToken) {
      const storageData: InactivityStorage = { lastActivity: now, userId: currentUserId, sessionToken: currentSessionToken };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
      } catch (e) {
        // Storage might be disabled or full
      }
      
      // Notify other tabs
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'activity', timestamp: now, userId: currentUserId, sessionToken: currentSessionToken });
      }
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;
    
    const now = Date.now();
    const timeUntilWarning = WARNING_TIMEOUT_MS;
    const timeUntilLogout = INACTIVITY_TIMEOUT_MS;
    
    warningTimerRef.current = setTimeout(() => {
      setState('warning');
    }, timeUntilWarning);
    
    logoutTimerRef.current = setTimeout(() => {
      setState('expired');
      onLogoutRef.current();
    }, timeUntilLogout);
  }, [clearTimers]);

  const staySignedIn = useCallback(() => {
    // Check expiry first
    const now = Date.now();
    const currentUserId = userIdRef.current;
    const currentSessionToken = sessionTokenRef.current;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: InactivityStorage = JSON.parse(stored);
        if (data.userId === currentUserId && data.sessionToken === currentSessionToken) {
          const elapsed = now - data.lastActivity;
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            // Already expired, cannot revive
            setState('expired');
            onLogoutRef.current();
            return;
          }
        }
      }
    } catch (e) {
      // Storage error, proceed
    }
    
    recordActivity();
    setState('active');
    resetTimers();
  }, [recordActivity, resetTimers]);

  const checkExpiration = useCallback(() => {
    const currentUserId = userIdRef.current;
    const currentSessionToken = sessionTokenRef.current;
    if (!currentUserId || !currentSessionToken) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: InactivityStorage = JSON.parse(stored);
        if (data.userId !== currentUserId || data.sessionToken !== currentSessionToken) {
          // Different user or session, start fresh
          recordActivity();
          resetTimers();
          return;
        }
        
        const now = Date.now();
        const elapsed = now - data.lastActivity;
        
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          // Already expired
          setState('expired');
          onLogoutRef.current();
          return;
        }
        
        if (elapsed >= WARNING_TIMEOUT_MS) {
          setState('warning');
        }
        
        // Update local ref and reset timers based on stored activity
        lastActivityRef.current = data.lastActivity;
        resetTimers();
      } else {
        // No stored data, start fresh
        recordActivity();
        resetTimers();
      }
    } catch (e) {
      // Storage error, start fresh
      recordActivity();
      resetTimers();
    }
  }, [recordActivity, resetTimers]);

  useEffect(() => {
    const currentUserId = userIdRef.current;
    const currentSessionToken = sessionTokenRef.current;
    if (!currentUserId || !currentSessionToken) {
      clearTimers();
      return;
    }

    // Check for existing expiration on mount/focus
    checkExpiration();

    // Set up cross-tab communication
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      
      channel.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'activity' && message.userId === currentUserId && message.sessionToken === currentSessionToken) {
          // Activity in another tab with same session, update our timers
          lastActivityRef.current = message.timestamp;
          resetTimers();
        } else if (message.type === 'logout' && message.userId === currentUserId) {
          // Logout in another tab for same user
          setState('expired');
          onLogoutRef.current();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported (e.g., in some private browsing modes)
    }

    // Set up activity listeners
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleActivity = () => recordActivity();
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Handle visibility change (tab return)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle window focus
    const handleFocus = () => {
      checkExpiration();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimers();
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, [recordActivity, clearTimers, resetTimers, checkExpiration]);

  const manualLogout = useCallback(() => {
    clearTimers();
    setState('expired');
    
    const currentUserId = userIdRef.current;
    
    // Notify other tabs
    if (channelRef.current && currentUserId) {
      channelRef.current.postMessage({ type: 'logout', userId: currentUserId });
    }
    
    // Clear storage and set expired marker
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(EXPIRED_MARKER_KEY, Date.now().toString());
    } catch (e) {
      // Storage might be disabled
    }
    
    onLogoutRef.current();
  }, [clearTimers]);

  return {
    state,
    staySignedIn,
    manualLogout,
  };
}
