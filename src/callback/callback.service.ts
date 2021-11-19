import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { merge, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { FoliageService } from '../foliage/foliage.service';
import { RecordService } from '../record/record.service';
import { ConfigService } from '@nestjs/config';
import { DeviceService } from '../shared/device/device.service';
import { Screen } from '../record/models/screen.entity';
import { FaceDetectMessage } from './requests/FaceDetectMessage';
import { ClientKafka } from '@nestjs/microservices';
import { KoalaService } from '../shared/koala/koala.service';

@Injectable()
export class CallbackService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private foliageService: FoliageService,
    private recordService: RecordService,
    private configService: ConfigService,
    private deviceService: DeviceService,
    private koalaService: KoalaService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.subscribeToResponseOf('recognized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
  }

  public async handleFaceDetectedEvent(message: FaceDetectMessage) {
    // Get root server
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) {
      new Logger('FaceID', { timestamp: true }).log(`Server is not set up yet`);
      return;
    }

    // Get pads
    let pads;
    try {
      const padTokens = await this.deviceService.getPadByBoundStream(
        message.source_id,
      );
      pads = await Promise.all(
        padTokens.map((token) =>
          this.deviceService.getPadByToken(token).catch((reason) => {
            new Logger('FaceID', { timestamp: true }).log(
              `Pad ${token} removed, Unbinding from stream: (${reason.message})`,
            );
            this.deviceService.unbindPad(token, message.source);
          }),
        ),
      );

      if (pads.length === 0) {
        new Logger('FaceID', { timestamp: true }).log(
          `No pad was found for ${message.source_id}`,
        );
        return;
      }
    } catch (e) {
      new Logger('FaceID', { timestamp: true }).log(
        `Pad not found: ${e.message}`,
      );
      return;
    }

    const fileBuffer = Buffer.from(message.head, 'base64');
    new Logger('FaceID', { timestamp: true }).log(
      `Load image size: ${fileBuffer.length}`,
    );

    const uploadToAll = pads.map((pad) =>
      this.recognizeAndUpload(
        server,
        { buffer: fileBuffer, originalname: message.tracking_id + '.jpg' },
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
    return this.koalaService
      .recognizeAndUploadEvent(server, pad, photo, timestamp)
      .pipe(
        catchError((err) => {
          new Logger('FoliageService').error(err);
          return of(null);
        }),
      );
  }
}
