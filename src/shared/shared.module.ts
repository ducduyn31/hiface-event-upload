import { Module } from '@nestjs/common';
import { ScreenInfo } from './screen-info';
import { ServerInfo } from './server-info';

@Module({
  providers: [
    {
      provide: ScreenInfo,
      useFactory: () => new ScreenInfo(),
    },
    {
      provide: ServerInfo,
      useFactory: () => new ServerInfo(),
    },
  ],
  exports: [
    {
      provide: ScreenInfo,
      useExisting: ScreenInfo,
    },
    {
      provide: ServerInfo,
      useExisting: ServerInfo,
    },
  ],
})
export class SharedModule {}
