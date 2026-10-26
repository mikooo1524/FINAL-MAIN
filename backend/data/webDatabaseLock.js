// Keep the lock for the page's lifetime: closing a SQLite connection does not
// release expo-sqlite's worker-owned file pool. The browser releases it on exit.
// Store the promise globally so Fast Refresh cannot request a second lock.
export function waitForWebDatabaseLock() {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return Promise.resolve();
  }

  if (!globalThis.__eventgearDatabaseLock) {
    globalThis.__eventgearDatabaseLock = new Promise((resolve, reject) => {
      navigator.locks.request('eventgear-sqlite-file-pool', async () => {
        resolve();
        await new Promise(() => {});
      }).catch(reject);
    });
  }

  return globalThis.__eventgearDatabaseLock;
}
