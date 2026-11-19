import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';

import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.service).toBe('quickprint-qr-api');
      });
  });

  it('/sessions (GET) refuse un visiteur non authentifie', () => {
    return request(app.getHttpServer()).get('/sessions').expect(401);
  });

  it('/sessions (POST) refuse un visiteur non authentifie', () => {
    return request(app.getHttpServer()).post('/sessions').send({}).expect(401);
  });

  it('/public/sessions/:token refuse un token invalide', () => {
    return request(app.getHttpServer())
      .get('/public/sessions/token-invalide')
      .expect(404)
      .expect((response) => {
        expect(response.body.message).toBe('Session introuvable ou invalide.');
      });
  });

  it("/public/sessions/:token/uploads (POST) refuse un token invalide", () => {
    return request(app.getHttpServer())
      .post('/public/sessions/token-invalide/uploads')
      .send({ fileName: 'CV.pdf', sizeBytes: 1024 })
      .expect(404);
  });

  it("/public/sessions/:token/uploads/:id/finalize (POST) refuse un token invalide", () => {
    return request(app.getHttpServer())
      .post(
        '/public/sessions/token-invalide/uploads/00000000-0000-0000-0000-000000000000/finalize',
      )
      .expect(404);
  });

  it("limite les demandes d'autorisation d'envoi", async () => {
    for (let index = 0; index < 30; index += 1) {
      await request(app.getHttpServer())
        .post('/public/sessions/token-invalide/uploads')
        .send({ fileName: 'CV.pdf', sizeBytes: 1024 })
        .expect(404);
    }

    await request(app.getHttpServer())
      .post('/public/sessions/token-invalide/uploads')
      .send({ fileName: 'CV.pdf', sizeBytes: 1024 })
      .expect(429);
  });

  afterEach(async () => {
    await app.close();
  });
});
