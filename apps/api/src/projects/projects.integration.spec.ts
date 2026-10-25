import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { ProjectsModule } from './projects.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { createPrismaMock, mockProject } from '../../test/test-setup';

describe('Projects (integration)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: JwtService;

  const projectId = 'project-1';
  const validProject = {
    name: 'My Protocol',
    description: 'A DeFi project',
    network: 'testnet',
  };

  beforeAll(async () => {
    prisma = createPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ProjectsModule,
        PrismaModule,
        AuthModule,
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function authHeader(userId = 'user-1'): { Authorization: string } {
    return { Authorization: `Bearer ${jwtService.sign({ sub: userId })}` };
  }

  // ─── Auth Guard ───────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('should return 401 for all endpoints without token', async () => {
      await request(app.getHttpServer()).get('/api/projects').expect(401);
      await request(app.getHttpServer()).get('/api/projects/1').expect(401);
      await request(app.getHttpServer()).post('/api/projects').expect(401);
      await request(app.getHttpServer()).patch('/api/projects/1').expect(401);
      await request(app.getHttpServer()).delete('/api/projects/1').expect(401);
    });
  });

  // ─── GET /api/projects ────────────────────────────────────────────────

  describe('GET /api/projects', () => {
    it('should list projects for authenticated user', async () => {
      prisma.project.findMany.mockResolvedValue([
        mockProject({ id: 'p1', name: 'Project 1' }),
        mockProject({ id: 'p2', name: 'Project 2' }),
      ]);
      prisma.project.count.mockResolvedValue(2);

      const res = await request(app.getHttpServer())
        .get('/api/projects')
        .set(authHeader())
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });

    it('should filter by search query', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject({ name: 'DeFi' })]);
      prisma.project.count.mockResolvedValue(1);

      const res = await request(app.getHttpServer())
        .get('/api/projects?search=DeFi')
        .set(authHeader())
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            name: { contains: 'DeFi', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by network', async () => {
      prisma.project.findMany.mockResolvedValue([mockProject({ network: 'mainnet' })]);
      prisma.project.count.mockResolvedValue(1);

      await request(app.getHttpServer())
        .get('/api/projects?network=mainnet')
        .set(authHeader())
        .expect(200);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ network: 'mainnet' }),
        }),
      );
    });

    it('should paginate results', async () => {
      prisma.project.findMany.mockResolvedValue([]);
      prisma.project.count.mockResolvedValue(25);

      const res = await request(app.getHttpServer())
        .get('/api/projects?page=2&limit=5')
        .set(authHeader())
        .expect(200);

      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.totalPages).toBe(5);
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ─── GET /api/projects/:id ────────────────────────────────────────────

  describe('GET /api/projects/:id', () => {
    it('should return a single project', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject());

      const res = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.data.id).toBe(projectId);
      expect(res.body.data.name).toBe('Test Project');
    });

    it('should return 404 for non-existent project', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/projects/non-existent')
        .set(authHeader())
        .expect(404);
    });

    it('should not return another user project (scoped to userId)', async () => {
      prisma.project.findFirst.mockResolvedValue(null); // not found for user-1

      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set(authHeader('user-2'))
        .expect(404);

      // Verify userId was passed to the query
      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: projectId, userId: 'user-2' },
        }),
      );
    });
  });

  // ─── POST /api/projects ───────────────────────────────────────────────

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      prisma.project.create.mockResolvedValue(mockProject({ ...validProject, contracts: [] }));

      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set(authHeader())
        .send(validProject)
        .expect(201);

      expect(res.body.data.name).toBe(validProject.name);
      expect(res.body.data.network).toBe(validProject.network);

      expect(prisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ...validProject, userId: 'user-1' },
        }),
      );
    });

    it('should create project without description', async () => {
      prisma.project.create.mockResolvedValue(mockProject({ name: 'Minimal', description: null }));

      const res = await request(app.getHttpServer())
        .post('/api/projects')
        .set(authHeader())
        .send({ name: 'Minimal', network: 'testnet' })
        .expect(201);

      expect(res.body.data.name).toBe('Minimal');
      expect(res.body.data.description).toBeNull();
    });

    it('should return 400 for empty name', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set(authHeader())
        .send({ name: '', network: 'testnet' })
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set(authHeader())
        .send({ name: 'Only name' }) // missing network
        .expect(400);
    });

    it('should return 400 for extra properties', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set(authHeader())
        .send({ ...validProject, malicious: true })
        .expect(400);
    });
  });

  // ─── PATCH /api/projects/:id ──────────────────────────────────────────

  describe('PATCH /api/projects/:id', () => {
    it('should update a project', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject());
      prisma.project.update.mockResolvedValue(
        mockProject({ name: 'Updated Name', description: 'New desc' }),
      );

      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set(authHeader())
        .send({ name: 'Updated Name', description: 'New desc' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Name');
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Updated Name', description: 'New desc' },
        }),
      );
    });

    it('should update only name', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject());
      prisma.project.update.mockResolvedValue(mockProject({ name: 'Renamed' }));

      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set(authHeader())
        .send({ name: 'Renamed' })
        .expect(200);

      expect(res.body.data.name).toBe('Renamed');
    });

    it('should return 404 for non-existent project', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/api/projects/non-existent')
        .set(authHeader())
        .send({ name: 'Nope' })
        .expect(404);
    });
  });

  // ─── DELETE /api/projects/:id ─────────────────────────────────────────

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      prisma.project.findFirst.mockResolvedValue(mockProject());
      prisma.project.delete.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.data.message).toBe('Project deleted');
      expect(prisma.project.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: projectId } }),
      );
    });

    it('should return 404 for non-existent project', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete('/api/projects/non-existent')
        .set(authHeader())
        .expect(404);
    });
  });

  // ─── POST /api/projects/:id/contracts ─────────────────────────────────

  describe('POST /api/projects/:id/contracts', () => {
    it('should create contract with multipart/form-data and .rs file', async () => {
      const rustContent = 'pub fn deposit() { require_auth(); }';
      const fileBuffer = Buffer.from(rustContent);

      prisma.contract.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'c-upload-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );

      const res = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/contracts`)
        .set(authHeader())
        .field('name', 'PoolContract')
        .field('address', 'CABC1234567890XYZ')
        .field('network', 'testnet')
        .attach('file', fileBuffer, 'pool.rs')
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('PoolContract');
      expect(res.body.data.sourceHash).toBeDefined();
      expect(res.body.data.sourcePath).toBeDefined();
    });

    it('should reject non-.rs file upload with 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/contracts`)
        .set(authHeader())
        .field('name', 'BadContract')
        .field('address', 'CABC1234567890XYZ')
        .field('network', 'testnet')
        .attach('file', Buffer.from('hello'), 'bad.txt')
        .expect(400);
    });
  });
});
