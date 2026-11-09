import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('retourne un etat de sante valide', () => {
      const health = appController.getHealth();

      expect(health.status).toBe('ok');
      expect(health.service).toBe('quickprint-qr-api');
      expect(health.version).toBe('0.1.0');
      expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
    });
  });
});
