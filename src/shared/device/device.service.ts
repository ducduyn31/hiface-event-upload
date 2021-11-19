import {
  CACHE_MANAGER,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ServerInfo } from '../server-info';
import { ScreenInfo } from '../screen-info';
import { catchError, map, pluck } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Screen } from '../../record/models/screen.entity';
import { Repository } from 'typeorm';
import { KoalaService } from '../koala/koala.service';
import { throwError } from 'rxjs';
import * as moment from 'moment';
import { VerificationMode } from '../../record/record';
import { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class DeviceService {
  constructor(
    private http: HttpService,
    private koalaService: KoalaService,
    @InjectRepository(Screen) private screenRepository: Repository<Screen>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get the first pad that match the location by query the database
   * @param location
   */
  async getPadByLocation(location: string) {
    if (!location) {
      throw new HttpException('Please provide pad location', 400);
    }
    return await this.screenRepository.findOneOrFail({
      deviceLocation: location,
    });
  }

  /**
   * Get the first pad that match the pad token by query the database
   * @param token
   */
  async getPadByToken(token: string) {
    if (!token) {
      throw new HttpException('Please provide pad token', 400);
    }
    return await this.screenRepository.findOneOrFail({
      deviceToken: token,
    });
  }

  /**
   * Get all pads in database
   */
  async getAllPads() {
    return await this.screenRepository.find({});
  }

  /**
   * Get all pads that is bound to a rtsp source from cache
   * @param stream rtsp source
   */
  async getPadByBoundStream(stream: string): Promise<string[]> {
    try {
      const rawPads = (await this.cacheManager.get(
        `stream:${stream}`,
      )) as string;
      if (!rawPads) return [];
      return JSON.parse(rawPads);
    } catch (e) {
      new Logger('DeviceService').error(e);
      return [];
    }
  }

  /**
   * Bind a rtsp stream with a pad using pad token
   * @param token the screen_token (deviceToken) of pad
   * @param stream rtsp source
   */
  async bindStream(token: string, stream: string): Promise<void> {
    const padsBound = await this.getPadByBoundStream(stream);
    if (padsBound.includes(token)) return;
    padsBound.push(token);
    await this.cacheManager.set(`stream:${stream}`, JSON.stringify(padsBound), {
      ttl: 0,
    });
  }

  /**
   * Unbind pad using pad token from rtsp stream
   * @param token
   * @param stream
   */
  async unbindPad(token: string, stream: string): Promise<string[]> {
    const padsBound = await this.getPadByBoundStream(stream);
    const findingPadIndex = padsBound.indexOf(token);
    if (findingPadIndex === -1) return;
    const newPads = padsBound.splice(findingPadIndex, 1);
    await this.cacheManager.set(stream, JSON.stringify(newPads));
    return newPads;
  }

  /**
   * Change default config of pad
   * @param server where koala locate
   * @param pad the new information of pad
   */
  configPad(server: ServerInfo, pad: ScreenInfo) {
    const configHost = `${server.host}:${server.port}/meglink/${pad.device_token}/config`;
    const configPayload = {
      timestamp: moment().unix(),
      'network.lan.ip': pad.network || 'virtual',
      'persty.location': pad.app_channel,
      'pass.face.recognition_mode': VerificationMode.FACE,
      'pass.verification_mode': VerificationMode.FACE,
      'sys.reboot_schedule': '5/02:00',
    };

    // the header required for requesting to koala, having token
    const configHeaders = KoalaService.generateOAuthHeaders(
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
            () =>
              new HttpException(
                `Failed to config ${pad.device_token} pad on server: ${err.message}`,
                400,
              ),
          ),
        ),
      );
  }

  /**
   * Create a virtual pad
   * @param server
   * @param pad
   */
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

    // the header required for requesting to koala, having token
    const loginHeaders = KoalaService.generateOAuthHeaders(
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
            () =>
              new HttpException(
                `Failed to create pad on server: ${err.message}`,
                400,
              ),
          ),
        ),
      );
  }
}
