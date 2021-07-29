import {
  CACHE_MANAGER,
  Controller,
  HttpException,
  Inject,
} from '@nestjs/common';
import * as moment from 'moment';
import { Cache } from 'cache-manager';
import { ServerInfo } from '../shared/server-info';
import { ScreenInfo } from '../shared/screen-info';
import { combineLatest } from 'rxjs';
import { mergeMap, pluck } from 'rxjs/operators';
import {
  LivenessType,
  PassType,
  RecognitionType,
  VerificationMode,
} from '../record/record';
import { FoliageService } from '../record/foliage/foliage.service';
import { RecordService } from '../record/record.service';
import * as fs from 'fs';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Controller('callback')
export class CallbackController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private foliageService: FoliageService,
    private recordService: RecordService,
    private configService: ConfigService,
  ) {}

  @MessagePattern('face-detected-event')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename } = message.value as any;
    this.handleEvent(filename);
    return 'OK';
  }

  private async handleEvent(filename: string) {
    const server: ServerInfo = await this.cacheManager.get('server');
    const pad: ScreenInfo = await this.cacheManager.get('screen');
    if (!server) throw new HttpException('Server is not set up yet', 400);
    if (!pad) throw new HttpException('Screen is not set up yet', 400);

    const fileBuffer = fs.readFileSync(
      path.join(this.configService.get('DATA_PATH'), filename),
    );

    return combineLatest([
      this.foliageService.recognize(server, {
        buffer: fileBuffer,
        originalname: filename,
      }),
      this.recordService
        .uploadRecordPhoto(server, pad, {
          buffer: fileBuffer,
          originalname: filename,
        })
        .pipe(pluck('data'), pluck('key')),
    ]).pipe(
      mergeMap((value) => {
        const [result, photoPath] = value;
        if (!result.recognized)
          throw new HttpException('Face is not recognizable', 300);
        return this.recordService.uploadEvent(
          server,
          pad,
          result.person.subject_id,
          photoPath as string,
          RecognitionType.EMPLOYEE,
          VerificationMode.FACE,
          PassType.PASS,
          +result.person.confidence,
          +result.person.confidence,
          LivenessType.NOT_DETECTED,
          moment().unix(),
        );
      }),
    );
  }
}
