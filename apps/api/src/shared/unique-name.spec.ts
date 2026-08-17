import { splitName, suggestAvailableName } from './unique-name';

describe('splitName', () => {
  it('separates stem from extension', () => {
    expect(splitName('report.pdf')).toEqual({ stem: 'report', extension: '.pdf' });
  });

  it('treats a name with no dot as all stem', () => {
    expect(splitName('Contracts')).toEqual({ stem: 'Contracts', extension: '' });
  });

  it('keeps a leading dot as part of the name', () => {
    expect(splitName('.env')).toEqual({ stem: '.env', extension: '' });
  });

  it('splits on the last dot only', () => {
    expect(splitName('q3.final.pdf')).toEqual({ stem: 'q3.final', extension: '.pdf' });
  });
});

describe('suggestAvailableName', () => {
  it('returns the name unchanged when nothing conflicts', () => {
    expect(suggestAvailableName('report.pdf', ['other.pdf'])).toBe('report.pdf');
  });

  it('appends a counter before the extension', () => {
    expect(suggestAvailableName('report.pdf', ['report.pdf'])).toBe('report (2).pdf');
  });

  it('skips counters that are also taken', () => {
    expect(suggestAvailableName('report.pdf', ['report.pdf', 'report (2).pdf'])).toBe(
      'report (3).pdf',
    );
  });

  it('does not stack counters on an already numbered name', () => {
    expect(suggestAvailableName('report (2).pdf', ['report (2).pdf'])).toBe('report (3).pdf');
  });

  it('works for names without an extension', () => {
    expect(suggestAvailableName('Contracts', ['Contracts'])).toBe('Contracts (2)');
  });

  it('compares case-insensitively, matching the way people read names', () => {
    expect(suggestAvailableName('Report.pdf', ['report.pdf'])).toBe('Report (2).pdf');
  });
});
