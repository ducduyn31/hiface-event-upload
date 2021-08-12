import { HttpService, Injectable, Logger } from '@nestjs/common';
import { ServerInfo } from '../../shared/server-info';
import * as FormData from 'form-data';
import { pluck } from 'rxjs/operators';

@Injectable()
export class FoliageService {
  constructor(private http: HttpService) {}

  recognize(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
    syncUrl: string,
  ) {
    const host = `${server.host}:8080/recognize`;
    new Logger('FoliageService').log(`Sync url: ${syncUrl}`);
    const form = new FormData();
    form.append('image', photo.buffer, { filename: photo.originalname });
    form.append('check_quality', 'false');
    form.append('group', syncUrl);
    form.append('limit', 1);
    return this.http
      .post(host, form, {
        headers: form.getHeaders(),
      })
      .pipe(pluck('data'));
  }
}
