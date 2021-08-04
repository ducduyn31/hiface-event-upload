import { HttpService, Injectable } from '@nestjs/common';
import { ServerInfo } from '../../shared/server-info';
import * as FormData from 'form-data';
import { pluck } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class FoliageService {
  constructor(private http: HttpService) {}

  recognize(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
    throwError = true,
  ) {
    const host = `${server.host}:8080/recognize`;
    // const host = `http://localhost:8080/recognize`;
    const form = new FormData();
    form.append('image', photo.buffer, { filename: photo.originalname });
    form.append('check_quality', 'false');
    form.append('group', 'http://localhost:8866/sync/features');
    form.append('limit', 1);
    if (throwError)
      return this.http
        .post(host, form, {
          headers: form.getHeaders(),
        })
        .pipe(pluck('data'));
    else {
      try {
        return this.http
          .post(host, form, {
            headers: form.getHeaders(),
          })
          .pipe(pluck('data'));
      } catch (e) {
        return of({
          recognized: false,
        });
      }
    }
  }
}
