import { Injectable, Logger } from '@nestjs/common';
import { catchError, map, pluck } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class RecordService {
  constructor(private http: HttpService, private config: ConfigService) {}

  alarmEvent(subject_id: any, screen_token: any) {
    const host = this.config.get('CALLBACK_URL');
    const payload = { subject_id: subject_id, screen_token: screen_token };
    const headers = {};
    return this.http
      .post(host, payload, {
        headers,
      })
      .pipe(
        pluck('data'),
        map((resp) => {
          if (resp.code !== 1000) throw new Error(resp.msg);
          return resp;
        }),
        catchError((err) => {
          new Logger('AlarmService').log(
            `Something happened to alarm service: ${err.message}`,
          );
          return of(null);
        }),
      )
      .subscribe();
  }
}
