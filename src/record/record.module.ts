import { Module } from '@nestjs/common';
import { RecordController } from './record.controller';

@Module({
  controllers: [RecordController]
})
export class RecordModule {}
