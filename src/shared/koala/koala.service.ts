import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ServerInfo } from '../server-info';
import { catchError, map, mergeMap, pluck } from 'rxjs/operators';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { FoliageService } from '../../foliage/foliage.service';
import { ConfigService } from '@nestjs/config';
import { Screen } from '../../record/models/screen.entity';
import { ScreenInfo } from '../screen-info';
import * as FormData from 'form-data';
import * as md5 from 'md5';
import * as uuid from 'uuid';
import {
  LivenessType,
  PassType,
  RecognitionType,
  VerificationMode,
} from '../../record/record';
import * as moment from 'moment';
import { generateSignature } from '../../utils/signature';
import { HttpCallbackService } from '../http-callback/httpcallback.service';

@Injectable()
export class KoalaService {
  constructor(
    private http: HttpService,
    private foliageService: FoliageService,
    private configService: ConfigService,
    private httpCallbackService: HttpCallbackService,
  ) {}

  /**
   * Get company id using username and password by trying to login using username
   * and password
   * @param server
   * @param username
   * @param password
   */
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
        catchError((err) =>
          throwError(
            () => new HttpException(`Failed to login: ${err.message}`, 400),
          ),
        ),
      );
  }

  /**
   * Upload new photo to koala
   * @param server
   * @param pad
   * @param photo
   */
  uploadRecordPhoto(
    server: ServerInfo,
    pad: ScreenInfo,
    photo: {
      buffer: Buffer;
      originalname: string;
    },
  ) {
    const host = `${server.host}:${server.port}/meglink/${pad.device_token}/file/upload`;

    // Prepare form
    const form = new FormData();
    form.append('type', 1);
    form.append('file', photo.buffer, {
      filename: photo.originalname,
    });

    // This is required to authenticate to koala
    const headers = KoalaService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/file/upload`,
      {},
      null,
      {
        type: '1',
        file: md5(photo.buffer),
      },
    );

    // Request to koala
    return this.http
      .post(host, form, {
        headers: {
          ...headers,
          ...form.getHeaders(),
        },
      })
      .pipe(
        pluck('data'),
        map((resp) => {
          if (resp.code !== 100000) throw new Error(resp.msg);
          return resp;
        }),
      );
  }

  /**
   * Upload event to koala
   * @param server where koala is located
   * @param pad which pad to upload via
   * @param subjectId which subject id
   * @param photoPath photo path
   * @param recognitionType employee, stranger or yellow list
   * @param verificationMode face, face + card or card
   * @param passType pass or not pass
   * @param recognitionScore confidence score
   * @param livenessScore how lively the subject is
   * @param livenessType living, nonliving or not detected
   * @param timestamp when the face is recognized
   */
  uploadEvent(
    server: ServerInfo,
    pad: ScreenInfo,
    subjectId: number,
    photoPath: string,
    recognitionType: RecognitionType,
    verificationMode: VerificationMode,
    passType: PassType,
    recognitionScore: number,
    livenessScore: number,
    livenessType: LivenessType,
    timestamp: number,
  ) {
    const host = `${server.host}:${server.port}/meglink/${pad.device_token}/record/batch_upload`;
    const payload = {
      record_list: [
        {
          person_id: subjectId,
          snapshot_uri: photoPath,
          recognition_type: +recognitionType,
          verification_mode: +verificationMode,
          pass_type: +passType,
          recognition_score: +recognitionScore,
          liveness_score: +livenessScore,
          liveness_type: +livenessType,
          timestamp: +timestamp,
        },
      ],
    };

    // This is required to authenticate request to koala
    const headers = KoalaService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/record/batch_upload`,
      {},
      payload,
      {},
    );

    // Activate callback endpoints
    this.httpCallbackService.activateAllEndpoints({
      person_id: subjectId,
      snapshot_uri: photoPath,
      recognition_type: +recognitionType,
      verification_mode: +verificationMode,
      pass_type: +passType,
      recognition_score: +recognitionScore,
      liveness_score: +livenessScore,
      liveness_type: +livenessType,
      timestamp: +timestamp,
      screen_token: pad.device_token,
      screen_source: pad.network,
      screen_name: pad.camera_name,
    });

    // Upload event via HTTP API
    return this.http
      .post(host, payload, {
        headers,
      })
      .pipe(
        pluck('data'),
        map((resp) => {
          if (resp.code !== 100000) throw new Error(resp.msg);
          return resp;
        }),
      );
  }

  /**
   * Recognize face and upload event to koala
   * @param server
   * @param pad
   * @param photo
   * @param timestamp
   */
  recognizeAndUploadEvent(
    server: ServerInfo,
    pad: Screen,
    photo: {
      buffer: Buffer;
      originalname: string;
    },
    timestamp: number,
  ) {
    // Recognize via foliage
    const recognizeFace = this.foliageService
      .recognize(
        server,
        photo,
        `${this.configService.get('PANDA_URL')}?company=${pad.companyId}`,
      )
      .pipe(
        catchError((err) => {
          new Logger('FoliageService').error(err.message);
          return of(null);
        }),
      );

    // Check for liveness via insight
    const livenessCheck = this.foliageService.livenessCheck(photo).pipe(
      catchError((err) => {
        new Logger('FoliageService').error(err.message);
        return of(null);
      }),
    );

    // Upload event image to koala
    const uploadPhoto = this.uploadRecordPhoto(
      server,
      pad.toScreenInfo(),
      photo,
    ).pipe(
      pluck('data', 'key'),
      catchError((err) => {
        new Logger('FoliageService').error(err.message);
        return of(null);
      }),
    );

    // Simultaneously recognize, check liveness and upload event
    return forkJoin([recognizeFace, livenessCheck, uploadPhoto]).pipe(
      mergeMap((result) => {
        const [recognize, liveness, photoPath] = result;

        if (!recognize || !photoPath) {
          return of(null);
        }

        const livenessThreshold = +this.configService.get('LIVENESS_THRESHOLD');

        // Then upload event, employee or stranger
        return this.uploadEvent(
          server,
          pad.toScreenInfo(),
          recognize.person.subject_id ? recognize.recognized : -1,
          photoPath as string,
          RecognitionType.EMPLOYEE
            ? recognize.recognized
            : RecognitionType.STRANGER,
          VerificationMode.FACE,
          PassType.PASS ? recognize.recognized : PassType.NO_PASS,
          +recognize.person.confidence ? recognize.recognized : null,
          !!liveness ? +liveness : 1,
          !!liveness
            ? +liveness >= livenessThreshold
              ? LivenessType.LIVING
              : LivenessType.NONLIVING
            : LivenessType.NOT_DETECTED,
          timestamp,
        ).pipe(
          map((resp) => ({
            code: resp?.code,
            subject_id: recognize.person.subject_id,
            confidence: +recognize.person.confidence,
          })),
          catchError((err) => {
            return throwError(() => err);
          }),
        );
      }),
    );
  }

  public static generateOAuthHeaders(
    server: ServerInfo,
    pad: ScreenInfo,
    url: string,
    query: any,
    data: any,
    form: any,
  ): Record<string, string> {
    const nonce = uuid.v1();
    const now = moment().unix();

    return {
      'OAuth-Version': '1.0',
      'OAuth-Token': pad.user_token || pad.device_token,
      'OAuth-Nonce': nonce,
      'OAuth-Timestamp': '' + now,
      'OAuth-Signature-Method': 'HMAC-SHA1',
      'OAuth-Signature': generateSignature(
        server,
        pad,
        'POST',
        url,
        query,
        data,
        form,
        now,
        nonce,
      ),
    };
  }
}
