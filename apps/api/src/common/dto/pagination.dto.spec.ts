import { PaginationDto } from './pagination.dto';

describe('PaginationDto', () => {
  it('provides sensible defaults for page, limit, and sortOrder', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.sortOrder).toBe('desc');
    expect(dto.getSkip()).toBe(0);
    expect(dto.getLimit()).toBe(10);
  });

  it('calculates correct database skip offsets', () => {
    const dto = new PaginationDto();
    dto.page = 4;
    dto.limit = 25;
    expect(dto.getSkip()).toBe(75);
    expect(dto.getLimit()).toBe(25);
  });

  it('strictly enforces 100 maximum page size', () => {
    const dto = new PaginationDto();
    dto.limit = 500;
    expect(dto.getLimit()).toBe(100);
    expect(dto.getSkip()).toBe(0);
  });

  it('handles orderBy safely and sanitizes against arbitrary fields', () => {
    const dto = new PaginationDto();
    const allowed = ['name', 'createdAt', 'updatedAt'] as const;

    // Allowed valid field with asc
    dto.sortBy = 'name';
    dto.sortOrder = 'asc';
    expect(dto.getOrderBy(allowed, 'createdAt')).toEqual({ name: 'asc' });

    // Arbitrary injected field falls back to defaultField
    dto.sortBy = 'malicious_column_drop_table';
    dto.sortOrder = 'desc';
    expect(dto.getOrderBy(allowed, 'createdAt')).toEqual({ createdAt: 'desc' });
  });

  it('generates consistent meta structure', () => {
    const dto = new PaginationDto();
    dto.page = 2;
    dto.limit = 15;

    const meta = dto.buildMeta(48);
    expect(meta).toEqual({
      total: 48,
      page: 2,
      limit: 15,
      totalPages: 4,
    });
  });

  it('handles zero total items gracefully', () => {
    const dto = new PaginationDto();
    const meta = dto.buildMeta(0);
    expect(meta).toEqual({
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });
});
