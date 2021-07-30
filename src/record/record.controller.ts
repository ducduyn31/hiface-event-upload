import {
  Body,
  CACHE_MANAGER,
  Controller,
  HttpException,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { ScreenInfo } from '../shared/screen-info';
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
import { mergeMap, pluck } from 'rxjs/operators';
import { FoliageService } from './foliage/foliage.service';
import { combineLatest } from 'rxjs';
import { NewDeviceRequest } from './requests/new-device.request';
import { customAlphabet } from 'nanoid';
import { DeviceService } from '../shared/device/device.service';

@Controller('record')
export class RecordController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private recordService: RecordService,
    private deviceService: DeviceService,
    private foliageService: FoliageService,
  ) {}

  @Post('quick')
  @UseInterceptors(FileInterceptor('photo'))
  async quick(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { pad_name: string },
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const pad = await this.deviceService.getPadByName(body.pad_name);

    return combineLatest([
      this.foliageService.recognize(server, file),
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), file)
        .pipe(pluck('data'), pluck('key')),
    ]).pipe(
      mergeMap((value) => {
        const [result, photoPath] = value;
        if (!result.recognized)
          throw new HttpException('Face is not recognizable', 300);
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
