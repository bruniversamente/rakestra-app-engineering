export const AUTH_TOKEN_KEY = 'auth_token';

export type TokenStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type SecureTokenVault = {
  isAvailable: () => Promise<boolean>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type SecureSessionPolicyOptions = {
  isWeb: boolean;
  legacyStorage: TokenStorage;
  secureVault: SecureTokenVault | null;
  secureReadTimeoutMs: number;
  onSecureStoreFailure?: (error?: unknown) => void;
};

export class NativeSecureStorageUnavailableError extends Error {
  readonly code = 'NATIVE_SECURE_STORAGE_UNAVAILABLE';

  constructor() {
    super('Native secure storage is unavailable');
    this.name = 'NativeSecureStorageUnavailableError';
  }
}

export class NativeSecureStorageReadTimeoutError extends Error {
  readonly code = 'NATIVE_SECURE_STORAGE_READ_TIMEOUT';

  constructor() {
    super('Secure storage read did not finish in time');
    this.name = 'NativeSecureStorageReadTimeoutError';
  }
}

const withRejectingTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new NativeSecureStorageReadTimeoutError()),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

export const createSecureSessionPolicy = ({
  isWeb,
  legacyStorage,
  secureVault,
  secureReadTimeoutMs,
  onSecureStoreFailure = () => undefined,
}: SecureSessionPolicyOptions) => {
  let nativeAvailabilityConfirmed = false;

  const isNativeVaultAvailable = async () => {
    if (!secureVault) return false;
    if (nativeAvailabilityConfirmed) return true;

    try {
      const available = await secureVault.isAvailable();
      nativeAvailabilityConfirmed = available === true;
      return nativeAvailabilityConfirmed;
    } catch (error) {
      nativeAvailabilityConfirmed = false;
      onSecureStoreFailure(error);
      return false;
    }
  };

  const removeLegacyToken = () => legacyStorage.removeItem(AUTH_TOKEN_KEY);

  const getToken = async (): Promise<string | null> => {
    if (isWeb) return legacyStorage.getItem(AUTH_TOKEN_KEY);

    if (!secureVault || !(await isNativeVaultAvailable())) {
      await removeLegacyToken();
      return null;
    }

    let secureToken: string | null;
    try {
      secureToken = await withRejectingTimeout(
        secureVault.getItem(AUTH_TOKEN_KEY),
        secureReadTimeoutMs,
      );
    } catch (error) {
      nativeAvailabilityConfirmed = false;
      onSecureStoreFailure(error);
      await removeLegacyToken();
      // A read deadline is not proof that the protected session is missing.
      // Keep access closed and let the caller offer an explicit retry.
      if (error instanceof NativeSecureStorageReadTimeoutError) throw error;
      return null;
    }

    if (secureToken) {
      await removeLegacyToken();
      return secureToken;
    }

    const legacyToken = await legacyStorage.getItem(AUTH_TOKEN_KEY);
    if (!legacyToken) return null;

    let migratedToVault = false;
    try {
      await secureVault.setItem(AUTH_TOKEN_KEY, legacyToken);
      migratedToVault = true;
      await removeLegacyToken();
      return legacyToken;
    } catch (error) {
      nativeAvailabilityConfirmed = false;
      onSecureStoreFailure(error);
      const cleanupTasks: Array<Promise<unknown>> = [removeLegacyToken()];
      if (migratedToVault) cleanupTasks.push(secureVault.removeItem(AUTH_TOKEN_KEY));
      await Promise.allSettled(cleanupTasks);
      return null;
    }
  };

  const setToken = async (token: string): Promise<void> => {
    if (isWeb) {
      await legacyStorage.setItem(AUTH_TOKEN_KEY, token);
      return;
    }

    if (!secureVault || !(await isNativeVaultAvailable())) {
      await removeLegacyToken();
      throw new NativeSecureStorageUnavailableError();
    }

    // A legacy bearer must be gone before a newly issued token is accepted.
    await removeLegacyToken();
    try {
      await secureVault.setItem(AUTH_TOKEN_KEY, token);
    } catch (error) {
      nativeAvailabilityConfirmed = false;
      onSecureStoreFailure(error);
      throw new NativeSecureStorageUnavailableError();
    }
  };

  const clearToken = async (): Promise<void> => {
    const tasks: Array<Promise<unknown>> = [removeLegacyToken()];
    if (!isWeb && secureVault) tasks.push(secureVault.removeItem(AUTH_TOKEN_KEY));

    const results = await Promise.allSettled(tasks);
    if (results.some((result) => result.status === 'rejected')) {
      nativeAvailabilityConfirmed = false;
      throw new Error('Could not remove the complete local authentication token');
    }
  };

  return { getToken, setToken, clearToken };
};
