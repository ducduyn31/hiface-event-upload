import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [ConfigController],
})
export class ConfigModule {}
