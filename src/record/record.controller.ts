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
import {
  LivenessType,
  PassType,
  RecognitionType,
  Record,
  VerificationMode,
} from './record';
import * as moment from 'moment';
import { mergeMap, pluck } from 'rxjs/operators';
import { FoliageService } from './foliage/foliage.service';
import { combineLatest } from 'rxjs';

@Controller('record')
export class RecordController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private recordService: RecordService,
    private foliageService: FoliageService,
  ) {}

  @Post('quick')
  @UseInterceptors(FileInterceptor('photo'))
  async quick(@UploadedFile() file: Express.Multer.File) {
    const server: ServerInfo = await this.cacheManager.get('server');
    const pad: ScreenInfo = await this.cacheManager.get('screen');
    if (!server) throw new HttpException('Server is not set up yet', 400);
    if (!pad) throw new HttpException('Screen is not set up yet', 400);

    return combineLatest([
      this.foliageService.recognize(server, file),
      this.recordService
        .uploadRecordPhoto(server, pad, file)
        .pipe(pluck('data'), pluck('key')),
    ]).pipe(
      mergeMap((value) => {
        const [result, photoPath] = value;
        if (!result.recognized)
          throw new HttpException('Face is not recognizable', 300);
        return this.recordService.uploadEvent(
          server,
          pad,
          result.person.subject_id,
          photoPath as string,
          RecognitionType.EMPLOYEE,
          VerificationMode.FACE,
          PassType.PASS,
          +result.person.confidence,
          +result.person.confidence,
          LivenessType.NOT_DETECTED,
          moment().unix(),
        );
      }),
    );
  }

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

  @Post('device')
  async createDevice(@Body() screen: ScreenInfo) {
    const server: ServerInfo = await this.cacheManager.get('server');
    if (!server) throw new HttpException('Server is not set up yet', 400);
    return screen;
  }
}
