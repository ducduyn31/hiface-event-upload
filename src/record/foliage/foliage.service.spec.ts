import { Test, TestingModule } from '@nestjs/testing';
import { FoliageService } from './foliage.service';

describe('FoliageService', () => {
  let service: FoliageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FoliageService],
    }).compile();

    service = module.get<FoliageService>(FoliageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
