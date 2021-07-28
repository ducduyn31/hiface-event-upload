import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';
import { ConfigModule } from './config/config.module';
import { CallbackModule } from './callback/callback.module';

@Module({
  imports: [SharedModule, RecordModule, ConfigModule, CallbackModule],
})
export class AppModule {}
