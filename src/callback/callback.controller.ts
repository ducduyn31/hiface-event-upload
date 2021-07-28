import {
  CACHE_MANAGER,
  Controller,
  Get,
  HttpException,
  Inject,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import * as moment from 'moment';
import * as SambaClient from 'samba-client';
import { Cache } from 'cache-manager';
import { ServerInfo } from '../shared/server-info';
import { ScreenInfo } from '../shared/screen-info';
import { combineLatest } from 'rxjs';
import { mergeMap, pluck } from 'rxjs/operators';
import {
  LivenessType,
  PassType,
  RecognitionType,
  VerificationMode,
} from '../record/record';
import { FoliageService } from '../record/foliage/foliage.service';
import { RecordService } from '../record/record.service';
import * as fs from 'fs';

@Controller('callback')
export class CallbackController {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private foliageService: FoliageService,
    private recordService: RecordService,
  ) {}

  @Get()
  onPhotoCaptured(@Req() request: Request) {
    const { location } = request.query;
    const remainderTenthMinutes = moment().minute() % 10;
    const roundedTime = moment().subtract(remainderTenthMinutes, 'minute');
    const filename = `${location} ${roundedTime.format(
      'DD_MM_YYYY HH.',
    )}${roundedTime.format('mm').substr(-1)}0.*`;

    const client = new SambaClient({
      address: '//192.168.51.12/Eocortex',
      username: 'admin',
      password: 'Tinhvan123',
    });

    this.handleEvent(client, filename);

    return 'OK';
  }

  private async handleEvent(client: SambaClient, filter: string) {
    const server: ServerInfo = await this.cacheManager.get('server');
    const pad: ScreenInfo = await this.cacheManager.get('screen');
    if (!server) throw new HttpException('Server is not set up yet', 400);
    if (!pad) throw new HttpException('Screen is not set up yet', 400);

    const files: any[] = await client.list(filter);

    const sortedFiles = files.sort((a, b) => b.modifyTime - a.modifyTime);
    if (sortedFiles.length == 0) return;
    const filename = sortedFiles[0].name;

    const file = await client.getFile(filename, `/home/hacker/tmp/${filename}`);
    const readStream = await fs.createReadStream(`/home/hacker/tmp/${filename}`);
    console.log(readStream);

    // return combineLatest([
    //   this.foliageService.recognize(server, file),
    //   this.recordService
    //     .uploadRecordPhoto(server, pad, file)
    //     .pipe(pluck('data'), pluck('key')),
    // ]).pipe(
    //   mergeMap((value) => {
    //     const [result, photoPath] = value;
    //     if (!result.recognized)
    //       throw new HttpException('Face is not recognizable', 300);
    //     return this.recordService.uploadEvent(
    //       server,
    //       pad,
    //       result.person.subject_id,
    //       photoPath as string,
    //       RecognitionType.EMPLOYEE,
    //       VerificationMode.FACE,
    //       PassType.PASS,
    //       +result.person.confidence,
    //       +result.person.confidence,
    //       LivenessType.NOT_DETECTED,
    //       moment().unix(),
    //     );
    //   }),
    // );
  }
}
