import { CACHE_MANAGER, Controller, Inject, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { Cache } from 'cache-manager';
import { ServerInfo } from '../shared/server-info';
import { forkJoin, of } from 'rxjs';
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
  ) {
  }

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

    const recognizeAndUpload = (photoBuffer: Buffer) =>
      forkJoin([
        this.foliageService
          .recognize(
            server,
            { buffer: photoBuffer, originalname: filename },
            `${this.configService.get('PANDA_URL')}?company=${pad.companyId}`,
          )
          .pipe(
            catchError((err) => {
              new Logger('FoliageService').error(err.message);
              return of(null);
            }),
          ),
        this.foliageService
          .livenessCheck({
            buffer: photoBuffer,
            originalname: filename,
          })
          .pipe(
            catchError((err) => {
              new Logger('FoliageService').error(err.message);
              return of(null);
            }),
          ),
        this.recordService
          .uploadRecordPhoto(server, pad.toScreenInfo(), {
            buffer: photoBuffer,
            originalname: filename,
          })
          .pipe(
            pluck('data', 'key'),
            catchError((err) => {
              new Logger('FoliageService').error(err.message);
              return of(null);
            }),
          ),
      ]).pipe(
        mergeMap((result) => {
          const [recognize, liveness, photoPath] = result;
          if (!recognize || !photoPath || !recognize.recognized) {
            new Logger('FoliageService').error('Face is not recognizable');
            return of(null);
          }

          const livenessThreshold =
            +this.configService.get('LIVENESS_THRESHOLD');

          return this.recordService
            .uploadEvent(
              server,
              pad.toScreenInfo(),
              recognize.person.subject_id,
              photoPath as string,
              RecognitionType.EMPLOYEE,
              VerificationMode.FACE,
              PassType.PASS,
              +recognize.person.confidence,
              +liveness,
              +liveness >= livenessThreshold
                ? LivenessType.LIVING
                : LivenessType.NONLIVING,
              moment().unix(),
            )
            .pipe(
              catchError((err) => {
                new Logger('FoliageService').error(err.message);
                return of(null);
              }),
            );
        }),
      );

    return this.foliageService
      .detectAndCrop(server, { buffer: fileBuffer, originalname: filename })
      .pipe(
        mergeMap((buffer) => recognizeAndUpload(buffer)),
        catchError((err) => {
          new Logger('FaceID').log(`Something failed: ${err.message}`);
          return of(null);
        }),
      )
      .subscribe();
  }
}
