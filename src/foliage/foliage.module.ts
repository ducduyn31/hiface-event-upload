import { Module } from '@nestjs/common';
import { FoliageService } from './foliage.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, ConfigModule.forRoot()],
  providers: [FoliageService],
  exports: [FoliageService],
})
export class FoliageModule {}
