import { describe, expect, it } from 'vitest';
import { blobToBase64 } from '../../src/helpers/export-utils';

describe('export utility helpers', () => {
  it('converts text blobs to base64 in the server test environment', async () => {
    const blob = new Blob(['Yeshua Academy Finance'], { type: 'text/plain' });

    await expect(blobToBase64(blob)).resolves.toBe('WWVzaHVhIEFjYWRlbXkgRmluYW5jZQ==');
  });

  it('converts binary blobs to base64 without text encoding loss', async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2, 253, 254, 255])]);

    await expect(blobToBase64(blob)).resolves.toBe('AAEC/f7/');
  });
});
