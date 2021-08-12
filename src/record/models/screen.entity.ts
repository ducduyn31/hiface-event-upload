import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ScreenInfo } from '../../shared/screen-info';

@Entity()
export class Screen {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', nullable: false })
  companyId: number;

  @Column({ name: 'token', unique: true, nullable: false })
  deviceToken: string;

  @Column({ name: 'name' })
  deviceName: string;

  @Column({ name: 'app_channel' })
  appChannel: string;

  @Column({ name: 'app_version' })
  appVersion: string;

  @Column({ name: 'rom_channel' })
  romChannel: string;

  @Column({ name: 'rom_version' })
  romVersion: string;

  @Column({ name: 'user_token', unique: true })
  userToken: string;

  @Column({ name: 'user_secret' })
  userSecret: string;

  @Column({ name: 'mqtt_username', unique: true })
  mqttUsername: string;

  @Column({ name: 'mqtt_password' })
  mqttPassword: string;

  @Column({ name: 'sn_number', unique: true })
  serial: string;

  @Column({ name: 'meglink_version' })
  meglinkVersion: string;

  toScreenInfo(): ScreenInfo {
    return {
      sn_number: this.serial,
      rom_version: this.romVersion,
      device_channel: this.romChannel,
      app_version: this.appVersion,
      app_channel: this.appChannel,
      device_token: this.deviceToken,
      client_version_list: '',
      user_secret: this.userSecret,
      factory_setting: true,
      user_token: this.userToken,
      password: '',
      username: '',
    };
  }
}
