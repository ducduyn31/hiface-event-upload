import { Module } from '@nestjs/common';
import { ScreenInfo } from './screen-info';

@Module({
  providers: [
    {
      provide: ScreenInfo,
      useFactory: () => new ScreenInfo(),
    },
  ],
  exports: [
    {
      provide: ScreenInfo,
      useExisting: ScreenInfo,
    },
  ],
})
export class SharedModule {}
