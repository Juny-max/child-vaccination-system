import { CanActivate, ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { ChwService } from '../src/chw/chw.service';
import { ChildrenSearchController } from '../src/chw/children-search.controller';

describe('Children Search Endpoints (e2e)', () => {
  let app: INestApplication;

  const mockChwService = {
    searchByIdentifier: jest.fn(),
    advancedSearch: jest.fn(),
  };

  let currentUser: { id: string; role: string } | null = {
    id: 'test-chw-user',
    role: 'chw',
  };

  const jwtGuard: CanActivate = {
    canActivate(context) {
      const req = context.switchToHttp().getRequest();
      if (!currentUser) {
        return false;
      }
      req.user = currentUser;
      return true;
    },
  };

  const rolesGuard: CanActivate = {
    canActivate(context) {
      const req = context.switchToHttp().getRequest();
      if (req.user?.role !== 'chw') {
        throw new ForbiddenException('Access denied: CHW role required');
      }
      return true;
    },
  };

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ChildrenSearchController],
      providers: [
        {
          provide: ChwService,
          useValue: mockChwService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(RolesGuard)
      .useValue(rolesGuard);

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = { id: 'test-chw-user', role: 'chw' };
  });

  it('returns 400 when quick search identifier is missing', async () => {
    await request(app.getHttpServer()).get('/api/children/search').expect(400);
  });

  it('returns 400 when quick search identifier exceeds max length', async () => {
    await request(app.getHttpServer())
      .get('/api/children/search')
      .query({ identifier: 'a'.repeat(65) })
      .expect(400);
  });

  it('returns 400 for quick search identifier with unsafe characters', async () => {
    await request(app.getHttpServer())
      .get('/api/children/search')
      .query({ identifier: "0551234567';DROP TABLE children;--" })
      .expect(400);
  });

  it('returns 403 for non-CHW role', async () => {
    currentUser = { id: 'facility-user', role: 'facility-nurse' };

    await request(app.getHttpServer())
      .get('/api/children/search')
      .query({ identifier: '0551234567' })
      .expect(403);
  });

  it('calls quick search service with identifier and authenticated user id', async () => {
    const expected = [
      {
        id: 'child-uuid',
        childId: 'CVCC-1',
        childName: 'Kofi Mensah',
        motherName: 'Ama Mensah',
        motherPhone: '0551234567',
        currentZoneName: 'Ablekuma Zone',
        catchmentAreaId: 'zone-id',
        requiresPull: true,
      },
    ];
    mockChwService.searchByIdentifier.mockResolvedValue(expected);

    const response = await request(app.getHttpServer())
      .get('/api/children/search')
      .query({ identifier: '0551234567' })
      .expect(200);

    expect(response.body).toEqual(expected);
    expect(mockChwService.searchByIdentifier).toHaveBeenCalledWith(
      '0551234567',
      'test-chw-user',
    );
  });

  it('accepts CVCC-style child ID identifiers for quick search', async () => {
    mockChwService.searchByIdentifier.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/children/search')
      .query({ identifier: 'CVCC-000123' })
      .expect(200);

    expect(mockChwService.searchByIdentifier).toHaveBeenCalledWith(
      'CVCC-000123',
      'test-chw-user',
    );
  });

  it('returns 400 when advanced search is missing required fields', async () => {
    await request(app.getHttpServer())
      .get('/api/children/advanced-search')
      .query({ childName: 'Kofi', motherName: 'Ama' })
      .expect(400);
  });

  it('returns 400 when advanced search DOB is invalid', async () => {
    await request(app.getHttpServer())
      .get('/api/children/advanced-search')
      .query({
        childName: 'Kofi',
        motherName: 'Ama Mensah',
        dob: 'not-a-date',
      })
      .expect(400);
  });

  it('calls advanced search service when all required fields are provided', async () => {
    const expected = [
      {
        id: 'child-uuid-2',
        childId: 'CVCC-2',
        childName: 'Abena Owusu',
        motherName: 'Efua Owusu',
        motherPhone: '0240001111',
        currentZoneName: 'Nungua Zone',
        catchmentAreaId: 'zone-2',
        requiresPull: false,
      },
    ];
    mockChwService.advancedSearch.mockResolvedValue(expected);

    const response = await request(app.getHttpServer())
      .get('/api/children/advanced-search')
      .query({
        childName: 'Abena',
        motherName: 'Efua Owusu',
        dob: '2022-05-16',
      })
      .expect(200);

    expect(response.body).toEqual(expected);
    expect(mockChwService.advancedSearch).toHaveBeenCalledWith(
      'Abena',
      'Efua Owusu',
      '2022-05-16',
      'test-chw-user',
    );
  });
});
