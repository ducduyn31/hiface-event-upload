import { Controller, Post, Req } from '@nestjs/common';
import { generateSignature } from '../utils/signature';

@Controller('record')
export class RecordController {
  @Post()
  post(@Req() request) {
    const signature = generateSignature(request);
    return signature;
  }
}
