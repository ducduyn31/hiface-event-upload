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
import { Record } from './record';
import * as moment from 'moment';
import { mergeMap, pluck } from 'rxjs/operators';

@Controller('record')
export class RecordController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private recordService: RecordService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('event_photo'))
  async post(
    @Body() record: Record,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const server: ServerInfo = await this.cacheManager.get('server');
    const pad: ScreenInfo = await this.cacheManager.get('screen');
    if (!server) throw new HttpException('Server is not set up yet', 400);
    if (!pad) throw new HttpException('Screen is not set up yet', 400);
    return this.recordService.uploadRecordPhoto(server, pad, file).pipe(
      pluck('data'),
      pluck('key'),
      mergeMap((photoPath) =>
        this.recordService.uploadEvent(
          server,
          pad,
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
}
