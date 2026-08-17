import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CreateFolderDto } from './create-folder.dto';

const PARENT_ID = '00000000-0000-4000-8000-000000000000';

function nameErrors(name: unknown): string[] {
  const dto = plainToInstance(CreateFolderDto, { name, parentId: PARENT_ID });

  return validateSync(dto)
    .filter((error) => error.property === 'name')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('folder name validation', () => {
  it.each([
    '01 Corporate',
    'Звіт Q3',
    'report (2).pdf',
    'a-b_c.d',
    'Material Contracts & Addenda',
    'FY2025',
  ])('accepts %s', (name) => {
    expect(nameErrors(name)).toEqual([]);
  });

  it('rejects a name containing a forward slash', () => {
    expect(nameErrors('legal/contracts')).toContain('A name cannot contain slashes.');
  });

  it('rejects a name containing a backslash', () => {
    expect(nameErrors('legal\\contracts')).toContain('A name cannot contain slashes.');
  });

  it('rejects an empty name', () => {
    expect(nameErrors('')).not.toEqual([]);
  });

  it('rejects a name that is only whitespace, because it is trimmed first', () => {
    expect(nameErrors('   ')).not.toEqual([]);
  });

  it('trims surrounding whitespace rather than rejecting it', () => {
    const dto = plainToInstance(CreateFolderDto, { name: '  Legal  ', parentId: PARENT_ID });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.name).toBe('Legal');
  });

  it('rejects a name longer than the column allows', () => {
    expect(nameErrors('x'.repeat(256))).toContain('Name must be at most 255 characters.');
  });

  it('rejects a non-string name', () => {
    expect(nameErrors(42)).not.toEqual([]);
  });
});
