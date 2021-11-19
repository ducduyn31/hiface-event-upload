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
import { Record } from './record';
import * as moment from 'moment';
import { delay, map, mergeMap, pluck, tap } from 'rxjs/operators';
import { FoliageService } from '../foliage/foliage.service';
import { of } from 'rxjs';
import { NewDeviceRequest } from './requests/new-device.request';
import { customAlphabet } from 'nanoid';
import { DeviceService } from '../shared/device/device.service';
import { KoalaService } from '../shared/koala/koala.service';
import { ScreenInfo } from '../shared/screen-info';

@Controller('record')
export class RecordController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private recordService: RecordService,
    private deviceService: DeviceService,
    private foliageService: FoliageService,
    private koalaService: KoalaService,
  ) {}

  @Post('quick')
  @UseInterceptors(FileInterceptor('photo'))
  async quick(@UploadedFile() file: Express.Multer.File, @Body() payload: any) {
    // Get root server
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    // Get pad
    let pad;
    const { pad_name: padName, token } = payload;
    try {
      if (token) {
        pad = await this.deviceService.getPadByToken(token);
      } else {
        pad = await this.deviceService.getPadByLocation(padName);
      }
    } catch (e) {
      new Logger('EventUpload').error(e.message);
      throw new HttpException('Failed to load pad', 400);
    }

    // Recognize one face, then upload to koala
    return this.koalaService.recognizeAndUploadEvent(
      server,
      pad,
      { buffer: file.buffer, originalname: file.originalname },
      moment().unix(),
    );
  }

  @UseInterceptors(FileInterceptor('event_photo'))
  async post(
    @Body() record: Record & { pad_name: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    const pad = await this.deviceService.getPadByLocation(record.pad_name);

    return this.koalaService
      .uploadRecordPhoto(server, pad.toScreenInfo(), file)
      .pipe(
        pluck('data'),
        pluck('key'),
        mergeMap((photoPath) =>
          this.koalaService.uploadEvent(
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

    const pad: ScreenInfo = {
      username: newDeviceRequest.username,
      password: newDeviceRequest.password,
      sn_number: generatedSN,
      rom_version: `Custom_V1.1.8`,
      app_version: `${newDeviceRequest.name}_V1.1.8`,
      factory_setting: true,
      device_token: deviceTokenGenerator(),
      device_channel: newDeviceRequest.name,
      app_channel: newDeviceRequest.name,
      camera_name: newDeviceRequest.name,
      user_token: '',
      user_secret: '',
      client_version_list: '',
      network: newDeviceRequest.network,
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
                camera_name: newDeviceRequest.name,
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
      camera_name: payload.name,
    });
  }

  @Post('device/:token/bind')
  async bindStream(@Param('token') token, @Body() payload) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    await this.deviceService.getPadByToken(token);
    if (!payload.source)
      throw new HttpException('`source` can not be empty', 400);

    await this.deviceService.bindStream(token, payload.source);
    return payload.source;
  }

  @Post('device/:token/unbind')
  async unbindStream(@Param('token') token, @Body() payload) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);

    await this.deviceService.getPadByToken(token);
    if (!payload.source)
      throw new HttpException('`source` can not be empty', 400);

    await this.deviceService.unbindPad(token, payload.source);
    return payload.source;
  }

  @Get('devices')
  listPads() {
    return this.deviceService.getAllPads().then((results) =>
      results.map((device) => ({
        id: device.id,
        name: device.appChannel,
        token: device.deviceToken,
        location: device.deviceLocation,
      })),
    );
  }
}
