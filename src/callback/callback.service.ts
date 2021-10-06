import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import fs from 'fs';
import path from 'path';
import { forkJoin, merge, of } from 'rxjs';
import { catchError, map, mergeMap, pluck, tap } from 'rxjs/operators';
import {
  LivenessType,
  PassType,
  RecognitionType,
  VerificationMode,
} from '../record/record';
import * as moment from 'moment';
import { Cache } from 'cache-manager';
import { FoliageService } from '../record/foliage/foliage.service';
import { RecordService } from '../record/record.service';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../shared/device/device.service';
import { Screen } from '../record/models/screen.entity';
import { FaceDetectMessage } from './requests/FaceDetectMessage';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class CallbackService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private foliageService: FoliageService,
    private recordService: RecordService,
    private configService: ConfigService,
    private deviceService: DeviceService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.subscribeToResponseOf('recognized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
  }

  public async handlePhotoCapturedEvent(
    filename: string,
    deviceLocation: string,
    image: string,
  ) {
    // Get root server
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) {
      new Logger('FaceID', true).log(`Server is not set up yet`);
      return;
    }

    // Get requested pad
    let pad;
    try {
      pad = await this.deviceService.getPadByLocation(deviceLocation);
    } catch (e) {
      new Logger('FaceID', true).log(`Pad not found: ${e.message}`);
      return;
    }
    new Logger('FaceID', true).log(`Found ${pad.appChannel} ${pad.deviceName}`);

    // Read the image
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

    return (
      this.foliageService
        // multi face detections, then crop
        .detectAndCrop(server, { buffer: fileBuffer, originalname: filename })
        .pipe(
          // for each face, recognize and upload event
          mergeMap((buffer) =>
            this.recognizeAndUpload(
              server,
              {
                buffer: buffer,
                originalname: filename,
              },
              pad,
              moment().unix(),
            ),
          ),
          catchError((err) => {
            new Logger('FaceID').log(`Something failed: ${err.message}`);
            return of(null);
          }),
        )
        .subscribe()
    );
  }

  public async handleFaceDetectedEvent(message: FaceDetectMessage) {
    // Get root server
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) {
      new Logger('FaceID', true).log(`Server is not set up yet`);
      return;
    }

    // Get pads
    let pads;
    try {
      const padTokens = await this.deviceService.getPadByBindedStream(
        message.source,
      );
      pads = await Promise.all(
        padTokens.map((token) =>
          this.deviceService.getPadByToken(token).catch((reason) => {
            new Logger('FaceID', true).log(
              `Pad ${token} removed, Unbinding from stream: (${reason.message})`,
            );
            this.deviceService.unbindPad(token, message.source);
          }),
        ),
      );
    } catch (e) {
      new Logger('FaceID', true).log(`Pad not found: ${e.message}`);
      return;
    }

    const fileBuffer = Buffer.from(message.head, 'base64');
    new Logger('FaceID', true).log(`Load image size: ${fileBuffer.length}`);

    const uploadToAll = pads.map((pad) =>
      this.recognizeAndUpload(
        server,
        { buffer: fileBuffer, originalname: message.oid + '.jpg' },
        pad,
        message.timestamp,
      ).pipe(
        tap((result) => {
          if (!result) return;
          return this.kafkaClient
            .send('recognized', {
              source: message.source,
              tracking_id: message.tracking_id,
              timestamp: message.timestamp,
              subject_id: result.subject_id,
              confidence: result.confidence,
            })
            .subscribe();
        }),
      ),
    );

    merge(...uploadToAll).subscribe((res) =>
      new Logger('FaceID').log(`Upload complete: ${JSON.stringify(res)}`),
    );

    return 'ok';
  }

  private recognizeAndUpload(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
    pad: Screen,
    timestamp: number,
  ) {
    return forkJoin([
      // Recognize face via foliage
      this.foliageService
        .recognize(
          server,
          photo,
          `${this.configService.get('PANDA_URL')}?company=${pad.companyId}`,
        )
        .pipe(
          catchError((err) => {
            new Logger('FoliageService').error(err.message);
            return of(null);
          }),
        ),
      // Detect liveness via Insight
      this.foliageService.livenessCheck(photo).pipe(
        catchError((err) => {
          new Logger('FoliageService').error(err.message);
          return of(null);
        }),
      ),
      // Upload image event to koala
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), photo)
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

        const livenessThreshold = +this.configService.get('LIVENESS_THRESHOLD');

        // Upload event to koala
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
            !!liveness ? +liveness : 1,
            !!liveness
              ? +liveness >= livenessThreshold
                ? LivenessType.LIVING
                : LivenessType.NONLIVING
              : LivenessType.NOT_DETECTED,
            timestamp,
          )
          .pipe(
            map((resp) => ({
              code: resp?.code,
              subject_id: recognize.person.subject_id,
              confidence: +recognize.person.confidence,
            })),
            catchError((err) => {
              new Logger('FoliageService').error(err.message);
              return of(null);
            }),
          );
      }),
    );
  }
}
