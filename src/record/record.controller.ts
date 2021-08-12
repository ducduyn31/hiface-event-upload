import {
  Body,
  CACHE_MANAGER,
  Controller,
  HttpException,
  Inject, Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { RecordService } from './record.service';
import { Cache } from 'cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  LivenessType,
  PassType,
  RecognitionType,
  Record,
  VerificationMode,
} from './record';
import * as moment from 'moment';
import { catchError, mergeMap, pluck, tap } from 'rxjs/operators';
import { FoliageService } from './foliage/foliage.service';
import { combineLatest, of } from 'rxjs';
import { NewDeviceRequest } from './requests/new-device.request';
import { customAlphabet } from 'nanoid';
import { DeviceService } from '../shared/device/device.service';
import { ConfigService } from '@nestjs/config';

@Controller('record')
export class RecordController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private recordService: RecordService,
    private deviceService: DeviceService,
    private foliageService: FoliageService,
    private configService: ConfigService,
  ) {
  }

  @Post('quick')
  @UseInterceptors(FileInterceptor('photo'))
  async quick(
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: any,
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    let pad;
    const { pad_name: padName } = payload;
    try {
      pad = await this.deviceService.getPadByName(padName);
    } catch (e) {
      new Logger('EventUpload').error(e.message);
      throw new HttpException('Failed to load pad', 400);
    }

    return combineLatest([
      this.foliageService
        .recognize(
          server,
          file,
          `${this.configService.get('PANDA_URL')}?company=${pad.companyId}`,
        )
        .pipe(
          catchError(() =>
            of(
              new HttpException(
                'failed to recognize via recognize service',
                400,
              ),
            ),
          ),
        ),
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), file)
        .pipe(
          pluck('data'),
          pluck('key'),
          catchError(() =>
            of(new HttpException('failed to upload event image', 400)),
          ),
        ),
    ]).pipe(
      mergeMap((value) => {
        const [result, photoPath] = value;
        if (!result.recognized)
          throw new HttpException('Face is not recognizable', 300);
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
            catchError(() =>
              of(new HttpException('failed to upload event', 400)),
            ),
          );
      }),
    );
  }

  @Post()
  @UseInterceptors(FileInterceptor('event_photo'))
  async post(
    @Body() record: Record & { pad_name: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const pad = await this.deviceService.getPadByName(record.pad_name);

    return this.recordService
      .uploadRecordPhoto(server, pad.toScreenInfo(), file)
      .pipe(
        pluck('data'),
        pluck('key'),
        mergeMap((photoPath) =>
          this.recordService.uploadEvent(
            server,
            pad.toScreenInfo(),
            record.person_id,
            photoPath as string,
            record.recognition_type,
            record.verification_mode,
            record.pass_type,
            record.recognition_score,
            record.liveness_score,
            record.liveness_type,
            moment().unix(),
          ),
        ),
        pluck('data'),
      );
  }

  @Post('device')
  async createDevice(@Body() newDeviceRequest: NewDeviceRequest) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const twoNumberGenerator = customAlphabet('1234567890', 2);
    const threeNumberGenerator = customAlphabet('1234567890', 3);
    const deviceTokenGenerator = customAlphabet('1234567890abcdef', 32);

    const generatedSN = `M014200${twoNumberGenerator()}201${threeNumberGenerator()}1${threeNumberGenerator()}`;

    return this.deviceService.createPadAndSave(server, {
      username: newDeviceRequest.username,
      password: newDeviceRequest.password,
      sn_number: generatedSN,
      rom_version: `Custom_V1.1.8`,
      app_version: `${newDeviceRequest.name}_V1.1.8`,
      factory_setting: true,
      device_token: deviceTokenGenerator(),
      device_channel: newDeviceRequest.name,
      app_channel: newDeviceRequest.name,
      user_token: '',
      user_secret: '',
      client_version_list: '',
    });
  }
}
