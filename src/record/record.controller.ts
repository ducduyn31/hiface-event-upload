import {
  Body,
  CACHE_MANAGER,
  Controller,
  Get,
  HttpException,
  Inject,
  Logger,
  Param,
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
import { catchError, delay, map, mergeMap, pluck, tap } from 'rxjs/operators';
import { FoliageService } from './foliage/foliage.service';
import { combineLatest, of, throwError } from 'rxjs';
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
  ) {}

  @Post('quick')
  @UseInterceptors(FileInterceptor('photo'))
  async quick(@UploadedFile() file: Express.Multer.File, @Body() payload: any) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    let pad;
    const { pad_name: padName, token } = payload;
    try {
      if (token) {
        pad = await this.deviceService.getPadByToken(token);
      } else {
        pad = await this.deviceService.getPadByName(padName);
      }
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
          catchError((err) => {
            new Logger('FoliageService').error(err.message);
            return throwError(
              new HttpException(
                `failed to recognize via recognize service`,
                400,
              ),
            );
          }),
        ),
      this.recordService
        .uploadRecordPhoto(server, pad.toScreenInfo(), file)
        .pipe(
          pluck('data'),
          pluck('key'),
          catchError((err) =>
            throwError(
              new HttpException(
                `failed to upload event image: ${err.message}`,
                400,
              ),
            ),
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
            catchError((err) =>
              throwError(
                new HttpException(
                  `failed to upload event: ${err.message}`,
                  400,
                ),
              ),
            ),
          );
      }),
    );
  }

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

    const pad = {
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
    };

    return this.deviceService.createPad(server, pad).pipe(
      tap((r) => {
        of(true)
          .pipe(
            delay(1000),
            mergeMap(() =>
              this.deviceService.configPad(server, {
                ...pad,
                user_token: r.data.token,
                user_secret: r.data.secret,
              }),
            ),
          )
          .subscribe((resp) => {
            if (resp.code !== 100000)
              new Logger('ConfigPad').error(`Failed to config pad: ${resp}`);
          });
      }),
      map((res) => ({
        code: res.code,
        data: {
          mqtt_address: res.data.mqtt_address,
          token: res.data.mqtt_client_id,
        },
      })),
    );
  }

  @Post('device/:token')
  async configDevice(@Param('token') token, @Body() payload) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const pad = await this.deviceService.getPadByToken(token);

    if (!payload.name) throw new HttpException('`name` can not be empty', 400);

    return this.deviceService.configPad(server, {
      ...pad.toScreenInfo(),
      app_channel: payload.name,
    });
  }

  @Get('devices')
  listPads() {
    return this.deviceService.getAllPads().then((results) =>
      results.map((device) => ({
        id: device.id,
        name: device.appChannel,
        token: device.deviceToken,
      })),
    );
  }

  // @Delete('devices')
  // removeAllPads() {
  //   return this.deviceService.truncatePads();
  // }
  //
  // @Delete('device/:id')
  // removePad(@Param('id') id) {
  //   return this.deviceService.removePad(id);
  // }
}
