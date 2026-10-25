/**
 * Prisma test helper: provides a mock PrismaService with all commonly used
 * methods, and utility types for type-safe mocking.
 */

export interface PrismaModelMock {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
}

export interface PrismaMock {
  user: PrismaModelMock;
  session: PrismaModelMock;
  project: PrismaModelMock;
  contract: PrismaModelMock;
  scan: PrismaModelMock;
  report: PrismaModelMock;
  notification: PrismaModelMock;
  auditRecord: PrismaModelMock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
}

function createModelMock(): PrismaModelMock {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
}

/**
 * Create a fully mocked PrismaService instance.
 * All model methods (findUnique, findFirst, findMany, create, update,
 * updateMany, delete, deleteMany, count) are jest mocks.
 */
export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    user: createModelMock(),
    session: createModelMock(),
    project: createModelMock(),
    contract: createModelMock(),
    scan: createModelMock(),
    report: createModelMock(),
    notification: createModelMock(),
    auditRecord: createModelMock(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: PrismaMock) => Promise<unknown>)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  });

  return mock;
}
