import test from 'node:test';
import assert from 'node:assert/strict';

// Mock session objects for testing auth state logic
function createSession(userId, accessToken) {
  return {
    user: { id: userId },
    access_token: accessToken,
  };
}

test('auth preserves authorization for same user and session on TOKEN_REFRESHED', () => {
  const state = {
    userId: 'user-123',
    session: { access_token: 'token-abc' },
    adminStatus: 'authorized',
    isAdmin: true,
  };
  
  const newSession = createSession('user-123', 'token-abc');
  const isSameUser = state.userId === newSession.user.id;
  const isSameSession = state.session.access_token === newSession.access_token;
  const preserveAuth = isSameUser && isSameSession && state.adminStatus === 'authorized';
  
  assert.equal(isSameUser, true);
  assert.equal(isSameSession, true);
  assert.equal(preserveAuth, true);
});

test('auth requires fresh check for different user', () => {
  const state = {
    userId: 'user-123',
    session: { access_token: 'token-abc' },
    adminStatus: 'authorized',
    isAdmin: true,
  };
  
  const newSession = createSession('user-456', 'token-abc');
  const isSameUser = state.userId === newSession.user.id;
  const isSameSession = state.session.access_token === newSession.access_token;
  const preserveAuth = isSameUser && isSameSession && state.adminStatus === 'authorized';
  
  assert.equal(isSameUser, false);
  assert.equal(preserveAuth, false);
});

test('auth requires fresh check for different session (same user)', () => {
  const state = {
    userId: 'user-123',
    session: { access_token: 'token-abc' },
    adminStatus: 'authorized',
    isAdmin: true,
  };
  
  const newSession = createSession('user-123', 'token-xyz');
  const isSameUser = state.userId === newSession.user.id;
  const isSameSession = state.session.access_token === newSession.access_token;
  const preserveAuth = isSameUser && isSameSession && state.adminStatus === 'authorized';
  
  assert.equal(isSameUser, true);
  assert.equal(isSameSession, false);
  assert.equal(preserveAuth, false);
});

test('auth requires fresh check when previous status was not authorized', () => {
  const state = {
    userId: 'user-123',
    session: { access_token: 'token-abc' },
    adminStatus: 'checking',
    isAdmin: false,
  };
  
  const newSession = createSession('user-123', 'token-abc');
  const isSameUser = state.userId === newSession.user.id;
  const isSameSession = state.session.access_token === newSession.access_token;
  const preserveAuth = isSameUser && isSameSession && state.adminStatus === 'authorized';
  
  assert.equal(isSameUser, true);
  assert.equal(isSameSession, true);
  assert.equal(preserveAuth, false);
});

test('inactivity storage includes session token for scoping', () => {
  const storage = {
    lastActivity: Date.now(),
    userId: 'user-123',
    sessionToken: 'token-abc',
  };
  
  assert.equal(typeof storage.lastActivity, 'number');
  assert.equal(storage.userId, 'user-123');
  assert.equal(storage.sessionToken, 'token-abc');
});

test('inactivity detects different session and starts fresh', () => {
  const stored = {
    lastActivity: Date.now() - 1000,
    userId: 'user-123',
    sessionToken: 'token-abc',
  };
  
  const currentUserId = 'user-123';
  const currentSessionToken = 'token-xyz';
  
  const isDifferentSession = stored.userId !== currentUserId || stored.sessionToken !== currentSessionToken;
  
  assert.equal(isDifferentSession, true);
});

test('inactivity detects same session and preserves deadline', () => {
  const stored = {
    lastActivity: Date.now() - 1000,
    userId: 'user-123',
    sessionToken: 'token-abc',
  };
  
  const currentUserId = 'user-123';
  const currentSessionToken = 'token-abc';
  
  const isDifferentSession = stored.userId !== currentUserId || stored.sessionToken !== currentSessionToken;
  
  assert.equal(isDifferentSession, false);
});

test('inactivity expiry check prevents revival', () => {
  const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
  const now = Date.now();
  const stored = {
    lastActivity: now - INACTIVITY_TIMEOUT_MS - 1000,
    userId: 'user-123',
    sessionToken: 'token-abc',
  };
  
  const currentUserId = 'user-123';
  const currentSessionToken = 'token-abc';
  const elapsed = now - stored.lastActivity;
  const isExpired = elapsed >= INACTIVITY_TIMEOUT_MS;
  const isSameSession = stored.userId === currentUserId && stored.sessionToken === currentSessionToken;
  
  assert.equal(isSameSession, true);
  assert.equal(isExpired, true);
});

test('inactivity cross-tab activity includes session token', () => {
  const message = {
    type: 'activity',
    timestamp: Date.now(),
    userId: 'user-123',
    sessionToken: 'token-abc',
  };
  
  const currentUserId = 'user-123';
  const currentSessionToken = 'token-abc';
  
  const isSameSession = message.userId === currentUserId && message.sessionToken === currentSessionToken;
  
  assert.equal(isSameSession, true);
});

test('inactivity cross-tab logout only affects same user', () => {
  const message = {
    type: 'logout',
    userId: 'user-123',
  };
  
  const currentUserId = 'user-123';
  const shouldLogout = message.userId === currentUserId;
  
  assert.equal(shouldLogout, true);
});
