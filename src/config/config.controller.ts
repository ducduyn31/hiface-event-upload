import { Body, Controller, Get, Put } from '@nestjs/common';
import { ScreenInfo } from '../shared/screen-info';
import { ServerInfo } from '../shared/server-info';

@Controller('config')
export class ConfigController {
  constructor(private screen: ScreenInfo, private server: ServerInfo) {}

  @Put('screen')
  updateScreen(@Body() screen: ScreenInfo) {
    this.screen.app_channel = screen.app_channel;
    this.screen.app_version = screen.app_version;
    this.screen.client_version_list = screen.client_version_list;
    this.screen.device_channel = screen.device_channel;
    this.screen.factory_setting = screen.factory_setting;
    this.screen.password = screen.password;
    this.screen.rom_version = screen.rom_version;
    this.screen.sn_number = screen.sn_number;
    this.screen.username = screen.app_channel;
    return this.screen;
  }

  @Get('screen')
  getScreen() {
    return this.screen;
  }

  @Put('server')
  updateServer(@Body() server: ServerInfo) {
    this.server.host = server.host;
    this.server.port = server.port;
    return this.server;
  }

  @Get('server')
  getServer() {
    return this.server;
  }
}
