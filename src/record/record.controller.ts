import { Controller, Post, Req } from '@nestjs/common';
import { generateSignature } from '../utils/signature';
import { ServerInfo } from '../shared/server-info';

@Controller('record')
export class RecordController {
  constructor(private server: ServerInfo) {}

  @Post()
  post(@Req() request) {
    const signature = generateSignature(request);
    return this.server;
  }
}
