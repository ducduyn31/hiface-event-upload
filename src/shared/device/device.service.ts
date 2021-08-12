import { HttpException, HttpService, Injectable, Logger } from '@nestjs/common';
import { ServerInfo } from '../server-info';
import { ScreenInfo } from '../screen-info';
import { pluck, tap } from 'rxjs/operators';
import { RecordService } from '../../record/record.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Screen } from '../../record/models/screen.entity';
import { Repository } from 'typeorm';
import { KoalaService } from '../koala/koala.service';

@Injectable()
export class DeviceService {
  constructor(
    private http: HttpService,
    private koalaService: KoalaService,
    @InjectRepository(Screen) private screenRepository: Repository<Screen>,
  ) {}

  async getPadByName(name: string) {
    if (!name) {
      throw new HttpException('Please provide pad name', 400);
    }
    return await this.screenRepository.findOneOrFail({
      deviceName: name,
    });
  }

  createPad(server: ServerInfo, pad: ScreenInfo) {
    const host = `${server.host}:${server.port}/meglink/${pad.device_token}/login`;
    const payload = {
      username: pad.username,
      password: pad.password,
      sn_number: pad.sn_number,
      factory_setting: pad.factory_setting,
      device_channel: pad.device_channel,
      app_channel: pad.app_channel,
      rom_version: pad.rom_version,
      app_version: pad.app_version,
    };

    const headers = RecordService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/login`,
      {},
      payload,
      {},
    );

    return this.http
      .post(host, payload, {
        headers,
      })
      .pipe(pluck('data'));
  }

  createPadAndSave(server: ServerInfo, pad: ScreenInfo) {
    return this.createPad(server, pad).pipe(
      tap((response) => {
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
