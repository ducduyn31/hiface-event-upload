import { CACHE_MANAGER, Controller, Inject, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { Cache } from 'cache-manager';
import { ServerInfo } from '../shared/server-info';
import { combineLatest, of } from 'rxjs';
import { catchError, mergeMap, pluck, tap } from 'rxjs/operators';
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
    const { filename, devicename, image } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    this.handleEvent(filename, devicename, image);
    return 'OK';
  }

  private async handleEvent(
    filename: string,
    deviceLocation: string,
    image: string,
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) {
      new Logger('FaceID', true).log(`Server is not set up yet`);
      return;
    }
    let pad;

    try {
      pad = await this.deviceService.getPadByLocation(deviceLocation);
    } catch (e) {
      new Logger('FaceID', true).log(`Pad not found: ${e.message}`);
      return;
    }
    new Logger('FaceID', true).log(`Found ${pad.appChannel} ${pad.deviceName}`);

    let fileBuffer;
    if (!image) {
      fileBuffer = fs.readFileSync(
        path.join(this.configService.get('DATA_PATH'), filename),
      );
      new Logger('FaceID', true).log(`Read ${filename}`);
    } else {
      fileBuffer = Buffer.from(image, 'base64');
      new Logger('FaceID', true).log(`Load image size: ${fileBuffer.length}`);
    }
    return combineLatest([
      this.foliageService
        .recognize(
          server,
          {
            buffer: fileBuffer,
            originalname: filename,
          },
          `${this.configService.get('PANDA_URL')}?company=${pad.companyId}`,
        )
        .pipe(
          catchError((err) => {
            new Logger('FaceID').error(`Foliage failed: ${err.message}`);
            return of(null);
          }),
        ),
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), {
          buffer: fileBuffer,
          originalname: filename,
        })
        .pipe(
          pluck('data'),
          pluck('key'),
          catchError((err) => {
            new Logger('FaceID').error(
              `Upload image event failed: ${err.message}`,
            );
            return of(null);
          }),
        ),
    ])
      .pipe(
        mergeMap((value) => {
          const [result, photoPath] = value;
          if (!result.recognized) {
            new Logger('FaceID', true).log('Face is not recognizable');
            return;
          }
          return this.recordService
            .uploadEvent(
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
            )
            .pipe(
              catchError((err) => {
                new Logger('FaceID', true).error(
                  `Upload event failed ${err.message}`,
                );
                return of(null);
              }),
            );
        }),
      )
      .subscribe();
  }
}
