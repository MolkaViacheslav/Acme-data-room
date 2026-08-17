import {
  ALLOWED_MIME_TYPE,
  MAX_UPLOAD_BYTES,
  checkUploadLimits,
  describeRejection,
} from './upload-limits';

describe('checkUploadLimits', () => {
  it('accepts a PDF within the limit', () => {
    expect(checkUploadLimits({ mimeType: ALLOWED_MIME_TYPE, sizeBytes: 1024 })).toBeNull();
  });

  it('accepts a file of exactly the maximum size', () => {
    expect(
      checkUploadLimits({ mimeType: ALLOWED_MIME_TYPE, sizeBytes: MAX_UPLOAD_BYTES }),
    ).toBeNull();
  });

  it('rejects one byte over the maximum', () => {
    expect(
      checkUploadLimits({ mimeType: ALLOWED_MIME_TYPE, sizeBytes: MAX_UPLOAD_BYTES + 1 }),
    ).toBe('TOO_LARGE');
  });

  it('rejects an empty file', () => {
    expect(checkUploadLimits({ mimeType: ALLOWED_MIME_TYPE, sizeBytes: 0 })).toBe('EMPTY');
  });

  it('rejects a negative size', () => {
    expect(checkUploadLimits({ mimeType: ALLOWED_MIME_TYPE, sizeBytes: -1 })).toBe('EMPTY');
  });

  it.each(['text/html', 'image/png', 'application/octet-stream', ''])('rejects %s', (mimeType) => {
    expect(checkUploadLimits({ mimeType, sizeBytes: 1024 })).toBe('NOT_A_PDF');
  });

  it('ignores content-type parameters', () => {
    expect(
      checkUploadLimits({ mimeType: 'application/pdf; charset=binary', sizeBytes: 1024 }),
    ).toBeNull();
  });

  it('ignores content-type casing', () => {
    expect(checkUploadLimits({ mimeType: 'APPLICATION/PDF', sizeBytes: 1024 })).toBeNull();
  });

  it('rejects a type that merely contains "pdf"', () => {
    expect(checkUploadLimits({ mimeType: 'application/pdfx', sizeBytes: 1024 })).toBe('NOT_A_PDF');
    expect(checkUploadLimits({ mimeType: 'text/html+pdf', sizeBytes: 1024 })).toBe('NOT_A_PDF');
  });

  it('checks the type before the size, so an oversized HTML file reads as the wrong type', () => {
    expect(checkUploadLimits({ mimeType: 'text/html', sizeBytes: MAX_UPLOAD_BYTES * 2 })).toBe(
      'NOT_A_PDF',
    );
  });
});

describe('describeRejection', () => {
  it('states the limit in the message rather than hiding it', () => {
    expect(describeRejection('TOO_LARGE')).toBe('Files must be 50 MB or smaller.');
  });

  it('has a human sentence for every reason', () => {
    for (const reason of ['NOT_A_PDF', 'TOO_LARGE', 'EMPTY'] as const) {
      expect(describeRejection(reason)).toMatch(/^[A-Z].*\.$/);
    }
  });
});
