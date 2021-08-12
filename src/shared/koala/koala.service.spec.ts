import { Test, TestingModule } from '@nestjs/testing';
import { KoalaService } from './koala.service';

describe('KoalaService', () => {
  let service: KoalaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KoalaService],
    }).compile();

    service = module.get<KoalaService>(KoalaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
