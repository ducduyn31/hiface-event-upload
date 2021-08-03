import {
  CACHE_MANAGER,
  Controller,
  HttpException,
  Inject,
  Logger,
} from '@nestjs/common';
import * as moment from 'moment';
import { Cache } from 'cache-manager';
import { ServerInfo } from '../shared/server-info';
import { combineLatest } from 'rxjs';
import { mergeMap, pluck, tap } from 'rxjs/operators';
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
import { DeviceService } from '../shared/device/device.service';

@Controller('callback')
export class CallbackController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private foliageService: FoliageService,
    private recordService: RecordService,
    private configService: ConfigService,
    private deviceService: DeviceService,
  ) {}

  @MessagePattern('face-detected-event')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename, devicename } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    this.handleEvent(filename, devicename);
    return 'OK';
  }

  private async handleEvent(filename: string, devicename: string) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const pad = await this.deviceService.getPadByName(devicename);
    new Logger('FaceID', true).log(`Found ${pad.deviceName}`);

    const fileBuffer = fs.readFileSync(
      path.join(this.configService.get('DATA_PATH'), filename),
    );
    new Logger('FaceID', true).log(`Read ${filename}`);

    return combineLatest([
      this.foliageService
        .recognize(server, {
          buffer: fileBuffer,
          originalname: filename,
        })
        .pipe(tap(() => new Logger('FaceID', true).log('Face analyzed'))),
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), {
          buffer: fileBuffer,
          originalname: filename,
        })
        .pipe(pluck('data'), pluck('key')),
    ])
      .pipe(
        mergeMap((value) => {
          const [result, photoPath] = value;
          if (!result.recognized) {
            new Logger('FaceId').log('Face is unrecognizable');
            throw new HttpException('Face is not recognizable', 300);
          }
          new Logger('FaceID', true).log('Pushing event to koala.');
          return this.recordService.uploadEvent(
            server,
            pad.toScreenInfo(),
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
      )
      .toPromise();
  }
}
