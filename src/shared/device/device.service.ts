import {
  CACHE_MANAGER,
  HttpException,
  HttpService,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ServerInfo } from '../server-info';
import { ScreenInfo } from '../screen-info';
import { catchError, map, pluck, tap } from 'rxjs/operators';
import { RecordService } from '../../record/record.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Screen } from '../../record/models/screen.entity';
import { Repository } from 'typeorm';
import { KoalaService } from '../koala/koala.service';
import { throwError } from 'rxjs';
import * as moment from 'moment';
import { VerificationMode } from '../../record/record';
import { Cache } from 'cache-manager';

@Injectable()
export class DeviceService {
  constructor(
    private http: HttpService,
    private koalaService: KoalaService,
    @InjectRepository(Screen) private screenRepository: Repository<Screen>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPadByLocation(location: string) {
    if (!location) {
      throw new HttpException('Please provide pad location', 400);
    }
    return await this.screenRepository.findOneOrFail({
      deviceLocation: location,
    });
  }

  async getPadByToken(token: string) {
    if (!token) {
      throw new HttpException('Please provide pad token', 400);
    }
    return await this.screenRepository.findOneOrFail({
      deviceToken: token,
    });
  }

  async getAllPads() {
    return await this.screenRepository.find({});
  }

  async getPadByBindedStream(stream: string): Promise<string[]> {
    const rawPads = (await this.cacheManager.get(stream)) as string;
    if (!rawPads) return [];
    return JSON.parse(rawPads);
  }

  async truncatePads() {
    return await this.screenRepository.delete({});
  }

  async removePad(id) {
    return await this.screenRepository.delete(id);
  }

  async bindStream(token: string, stream: string): Promise<void> {
    const padsBound = await this.getPadByBindedStream(stream);
    if (padsBound.includes(token)) return;
    padsBound.push(token);
    await this.cacheManager.set(stream, JSON.stringify(padsBound));
  }

  async unbindPad(token: string, stream: string): Promise<string[]> {
    const padsBound = await this.getPadByBindedStream(stream);
    const findingPadIndex = padsBound.indexOf(token);
    if (findingPadIndex === -1) return;
    const newPads = padsBound.splice(findingPadIndex, 1);
    await this.cacheManager.set(stream, JSON.stringify(newPads));
    return newPads;
  }

  configPad(server: ServerInfo, pad: ScreenInfo) {
    const configHost = `${server.host}:${server.port}/meglink/${pad.device_token}/config`;
    const configPayload = {
      timestamp: moment().unix(),
      'network.lan.ip': 'virtual',
      'persty.location': pad.app_channel,
      'pass.face.recognition_mode': VerificationMode.FACE,
      'pass.verification_mode': VerificationMode.FACE,
      'sys.reboot_schedule': '5/02:00',
    };
    const configHeaders = RecordService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/config`,
      {},
      configPayload,
      {},
    );
    return this.http
      .post(configHost, configPayload, {
        headers: configHeaders,
      })
      .pipe(
        pluck('data'),
        map((resp) => {
          if (resp.code !== 100000) throw new Error(resp.msg);
          return resp;
        }),
        catchError((err) =>
          throwError(
            new HttpException(
              `Failed to config ${pad.device_token} pad on server: ${err.message}`,
              400,
            ),
          ),
        ),
      );
  }

  createPad(server: ServerInfo, pad: ScreenInfo) {
    const loginHost = `${server.host}:${server.port}/meglink/${pad.device_token}/login`;

    const loginPayload = {
      username: pad.username,
      password: pad.password,
      sn_number: pad.sn_number,
      factory_setting: pad.factory_setting,
      device_channel: pad.device_channel,
      app_channel: pad.app_channel,
      rom_version: pad.rom_version,
      app_version: pad.app_version,
    };

    const loginHeaders = RecordService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/login`,
      {},
      loginPayload,
      {},
    );

    return this.http
      .post(loginHost, loginPayload, {
        headers: loginHeaders,
      })
      .pipe(
        pluck('data'),
        map((resp) => {
          if (resp.code != 100000) throw new Error(resp.msg);
          return resp;
        }),
        catchError((err) =>
          throwError(
            new HttpException(
              `Failed to create pad on server: ${err.message}`,
              400,
            ),
          ),
        ),
      );
  }

  createPadAndSave(server: ServerInfo, pad: ScreenInfo) {
    return this.createPad(server, pad).pipe(
      tap((response) => {
        new Logger('Create Pad').log(
          `Create pad ${pad.device_token} resulted in: ${JSON.stringify(
            response,
          )}`,
        );
        if (response.code !== 100000) return;

        const {
          data: {
            meglink_version,
            mqtt_username,
            mqtt_password,
            secret,
            token,
          },
        } = response;

        const { username, password } = pad;

        this.koalaService
          .getCompanyId(server, username, password)
          .pipe(
            tap((companyId) => {
              this.screenRepository.insert({
                deviceName: pad.app_channel,
                companyId: companyId,
                deviceToken: pad.device_token,
                appChannel: pad.app_channel,
                appVersion: pad.app_version,
                meglinkVersion: meglink_version,
                mqttPassword: mqtt_password,
                mqttUsername: mqtt_username,
                romChannel: pad.device_channel,
                romVersion: pad.rom_version,
                serial: pad.sn_number,
                userSecret: secret,
                userToken: token,
              });
            }),
          )
          .subscribe();
      }),
    );
  }
}
