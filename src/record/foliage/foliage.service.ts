import { HttpException, HttpService, Injectable, Logger } from '@nestjs/common';
import { ServerInfo } from '../../shared/server-info';
import * as FormData from 'form-data';
import {
  catchError,
  map,
  mergeAll,
  mergeMap,
  pluck,
  tap,
} from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { from, Observable, throwError } from 'rxjs';
import * as sharp from 'sharp';

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
          new Logger('FoliageService', true).log(`Complete recognition`),
        ),
      );
  }

  detect(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
  ): Observable<{
    faces_info: {
      rect: { left: number; right: number; top: number; bottom: number };
    }[];
  }> {
    const host = `${this.getFoliageHost(server)}/detect`;

    const form = new FormData();
    form.append('image', photo.buffer, { filename: photo.originalname });

    return this.http
      .post(host, form, {
        headers: form.getHeaders(),
      })
      .pipe(pluck('data'));
  }

  detectAndCrop(
    server: ServerInfo,
    photo: { buffer: Buffer; originalname: string },
  ): Observable<Buffer> {
    return this.detect(server, photo).pipe(
      pluck('faces_info'),
      map((faces_info) => faces_info.map((info) => info.rect)),
      tap((rects) =>
        new Logger('FoliageService').log(`Found ${rects.length} faces`),
      ),
      mergeMap(
        (
          rects: { left: number; right: number; top: number; bottom: number }[],
        ) =>
          from(
            rects.map((rect) =>
              sharp(photo.buffer)
                .extract({
                  left: rect.left,
                  top: rect.top,
                  height: rect.bottom - rect.top,
                  width: rect.right - rect.left,
                })
                .toBuffer(),
            ),
          ).pipe(mergeAll()),
      ),
      catchError((err) =>
        throwError(
          new HttpException(`Failed to retrieve faces: ${err.message}`, 400),
        ),
      ),
    );
  }

  livenessCheck(photo: { buffer: Buffer; originalname: string }) {
    const host = this.configService.get('LIVENESS_CHECK');
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
