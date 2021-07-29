import { HttpService, Injectable } from '@nestjs/common';
import { ServerInfo } from '../../shared/server-info';
import * as FormData from 'form-data';
import { pluck } from 'rxjs/operators';

@Injectable()
export class FoliageService {
  constructor(private http: HttpService) {}

  recognize(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
  ) {
    const host = `${server.host}:8080/recognize`;
    const form = new FormData();
    form.append('image', photo.buffer, { filename: photo.originalname });
    form.append('check_quality', 'false');
    form.append('group', 'http://localhost:8866/sync/features');
    form.append('limit', 1);
    return this.http
      .post(host, form, {
        headers: form.getHeaders(),
      })
      .pipe(pluck('data'));
  }
}
