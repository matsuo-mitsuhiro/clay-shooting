/**
 * Windows EPERM fix for Next.js dev server.
 * Patches fs.promises to retry file operations that fail with EPERM (Windows access denied).
 * This commonly happens with Windows Defender scanning new files.
 */
const fs = require('fs');
const originalWriteFile = fs.promises.writeFile;
const originalMkdir = fs.promises.mkdir;

async function retryOnEperm(fn, maxRetries = 5, delay = 100) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if ((e.code === 'EPERM' || e.code === 'EACCES') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

fs.promises.writeFile = function(path, data, options) {
  return retryOnEperm(() => originalWriteFile.call(fs.promises, path, data, options));
};

fs.promises.mkdir = function(path, options) {
  return retryOnEperm(() => originalMkdir.call(fs.promises, path, options));
};
