import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [SharedModule, RecordModule, ConfigModule],
})
export class AppModule {}
