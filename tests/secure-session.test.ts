import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_TOKEN_KEY,
  createSecureSessionPolicy,
  NativeSecureStorageUnavailableError,
  NativeSecureStorageReadTimeoutError,
  type SecureTokenVault,
  type TokenStorage,
} from '../src/secureSessionPolicy.ts';

const createLegacyStorage = (initial: string | null = null) => {
  let value = initial;
  const calls = { get: 0, set: 0, remove: 0 };
  const storage: TokenStorage = {
    getItem: async () => {
      calls.get += 1;
      return value;
    },
    setItem: async (_key, nextValue) => {
      calls.set += 1;
      value = nextValue;
    },
    removeItem: async () => {
      calls.remove += 1;
      value = null;
    },
  };
  return { storage, calls, read: () => value };
};

test('native set fails closed and never writes a bearer to legacy storage', async () => {
  const legacy = createLegacyStorage('old-token');
  const vault: SecureTokenVault = {
    isAvailable: async () => false,
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  await assert.rejects(
    session.setToken('new-secret-token'),
    NativeSecureStorageUnavailableError,
  );
  assert.equal(legacy.calls.set, 0);
  assert.equal(legacy.calls.remove, 1);
  assert.equal(legacy.read(), null);
});

test('a rejected availability probe is retried instead of being cached as false', async () => {
  const legacy = createLegacyStorage();
  let availabilityCalls = 0;
  const stored: string[] = [];
  const vault: SecureTokenVault = {
    isAvailable: async () => {
      availabilityCalls += 1;
      if (availabilityCalls === 1) throw new Error('transient probe failure');
      return true;
    },
    getItem: async () => null,
    setItem: async (_key, value) => { stored.push(value); },
    removeItem: async () => undefined,
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  await assert.rejects(session.setToken('first'), NativeSecureStorageUnavailableError);
  await session.setToken('second');
  assert.equal(availabilityCalls, 2);
  assert.deepEqual(stored, ['second']);
  assert.equal(legacy.calls.set, 0);
});

test('legacy native token is returned only after successful secure migration and deletion', async () => {
  const legacy = createLegacyStorage('legacy-secret');
  let secureValue: string | null = null;
  const vault: SecureTokenVault = {
    isAvailable: async () => true,
    getItem: async () => secureValue,
    setItem: async (_key, value) => { secureValue = value; },
    removeItem: async () => { secureValue = null; },
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  assert.equal(await session.getToken(), 'legacy-secret');
  assert.equal(secureValue, 'legacy-secret');
  assert.equal(legacy.read(), null);
  assert.equal(legacy.calls.remove, 1);
});

test('secure read failure never falls through to the legacy bearer', async () => {
  const legacy = createLegacyStorage('must-not-be-read');
  const vault: SecureTokenVault = {
    isAvailable: async () => true,
    getItem: async () => { throw new Error('keystore read failed'); },
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  assert.equal(await session.getToken(), null);
  assert.equal(legacy.calls.get, 0);
  assert.equal(legacy.calls.remove, 1);
  assert.equal(legacy.read(), null);
});

test('secure read timeout never falls through to the legacy bearer', async () => {
  const legacy = createLegacyStorage('must-not-be-read');
  const vault: SecureTokenVault = {
    isAvailable: async () => true,
    getItem: async () => new Promise<string | null>(() => undefined),
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 5,
  });

  await assert.rejects(session.getToken(), NativeSecureStorageReadTimeoutError);
  assert.equal(legacy.calls.get, 0);
  assert.equal(legacy.read(), null);
});

test('failed legacy migration requires sign-in and removes the plaintext copy', async () => {
  const legacy = createLegacyStorage('legacy-secret');
  const vault: SecureTokenVault = {
    isAvailable: async () => true,
    getItem: async () => null,
    setItem: async () => { throw new Error('keystore write failed'); },
    removeItem: async () => undefined,
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy.storage,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  assert.equal(await session.getToken(), null);
  assert.equal(legacy.read(), null);
  assert.equal(legacy.calls.remove, 1);
});

test('logout attempts both native stores even when one deletion fails', async () => {
  let legacyRemoveCalls = 0;
  let secureRemoveCalls = 0;
  const legacy: TokenStorage = {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => {
      legacyRemoveCalls += 1;
      throw new Error('legacy delete failed');
    },
  };
  const vault: SecureTokenVault = {
    isAvailable: async () => true,
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => { secureRemoveCalls += 1; },
  };
  const session = createSecureSessionPolicy({
    isWeb: false,
    legacyStorage: legacy,
    secureVault: vault,
    secureReadTimeoutMs: 50,
  });

  await assert.rejects(session.clearToken(), /complete local authentication token/);
  assert.equal(legacyRemoveCalls, 1);
  assert.equal(secureRemoveCalls, 1);
});

test('web strategy remains explicit and uses only its web storage', async () => {
  const legacy = createLegacyStorage();
  const session = createSecureSessionPolicy({
    isWeb: true,
    legacyStorage: legacy.storage,
    secureVault: null,
    secureReadTimeoutMs: 50,
  });

  await session.setToken('web-token');
  assert.equal(await session.getToken(), 'web-token');
  assert.equal(legacy.calls.set, 1);
  assert.equal(legacy.calls.get, 1);
  assert.equal(legacy.read(), 'web-token');
  assert.equal(AUTH_TOKEN_KEY, 'auth_token');
});
