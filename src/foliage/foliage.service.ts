import { Injectable, Logger } from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import * as FormData from 'form-data';
import { map, pluck, tap } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { Observable, of } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class FoliageService {
  constructor(
    private http: HttpService,
    private configService: ConfigService,
  ) {}

  private getFoliageHost(server: ServerInfo) {
    let host = `${server.host}:8080`;
    if (this.configService.get('ENV') === 'DEVELOPMENT') {
      host = 'http://127.0.0.1:8080';
    }
    return host;
  }

  recognize(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
    syncUrl: string,
  ) {
    const host = `${this.getFoliageHost(server)}/recognize`;

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
      .pipe(
        pluck('data'),
        tap(() =>
          new Logger('FoliageService', { timestamp: true }).log(
            `Complete recognition`,
          ),
        ),
      );
  }

  detect(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
  ): Observable<
    { left: number; right: number; top: number; bottom: number }[]
  > {
    const host = `${this.getFoliageHost(server)}/detect`;

    const form = new FormData();
    form.append('image', photo.buffer, { filename: photo.originalname });

    return this.http
      .post(host, form, {
        headers: form.getHeaders(),
      })
      .pipe(
        pluck('data', 'faces_info'),
        map((face_info) => face_info.rect),
      );
  }

  livenessCheck(photo: { buffer: Buffer; originalname: string }) {
    const host = this.configService.get('LIVENESS_CHECK');
    if (host.toLowerCase() === 'disable') {
      return of(1.0);
    }
    const payload = {
      analyzeOptions: {
        attributeTypes: {
          liveness: true,
        },
      },
      photoData: photo.buffer.toString('base64'),
    };

    return this.http.post(host, payload).pipe(
      pluck('data', 'faces'),
      map((faces) => faces[0]),
      pluck('attributes', 'liveness', 'pred'),
    );
  }
}
