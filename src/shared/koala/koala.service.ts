import { HttpException, HttpService, Injectable } from '@nestjs/common';
import { ServerInfo } from '../server-info';
import { catchError, pluck } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable()
export class KoalaService {
  constructor(private http: HttpService) {}

  getCompanyId(
    server: ServerInfo,
    username: string,
    password: string,
  ): Observable<number> {
    const loginUrl = `${server.host}:${server.port}/auth/login`;
    return this.http
      .post(
        loginUrl,
        {
          username,
          password,
        },
        {
          headers: {
            'User-Agent': 'Koala Admin',
          },
        },
      )
      .pipe(
        pluck('data'),
        pluck('data'),
        pluck('company'),
        pluck('id'),
        catchError(() => of(new HttpException('failed to login.', 400))),
      );
  }
}
