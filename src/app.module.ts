import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { RecordModule } from './record/record.module';

@Module({
  imports: [SharedModule, RecordModule],
})
export class AppModule {}
