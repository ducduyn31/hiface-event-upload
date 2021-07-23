import { Module } from '@nestjs/common';
import { RecordController } from './record.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [RecordController],
})
export class RecordModule {}
