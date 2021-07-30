import { HttpService, Injectable } from '@nestjs/common';
import { ServerInfo } from '../shared/server-info';
import { ScreenInfo } from '../shared/screen-info';
import * as uuid from 'uuid';
import * as moment from 'moment';
import { generateSignature } from '../utils/signature';
import { pluck } from 'rxjs/operators';
import * as FormData from 'form-data';
import * as md5 from 'md5';
import {
  LivenessType,
  PassType,
  RecognitionType,
  VerificationMode,
} from './record';

@Injectable()
export class RecordService {
  constructor(private http: HttpService) {}

  test(server: ServerInfo, pad: ScreenInfo, data: any) {
    const host = `${server.host}:${server.port}/meglink/test`;
    const headers = RecordService.generateOAuthHeaders(
      server,
      pad,
      '/meglink/test',
      {},
      data,
      {},
    );
    return this.http
      .post(host, data, {
        headers,
      })
      .pipe(pluck('data'));
  }

  uploadRecordPhoto(
    server: ServerInfo,
    pad: ScreenInfo,
    photo: {
      buffer: Buffer;
      originalname: string;
    },
  ) {
    const host = `${server.host}:${server.port}/meglink/${pad.device_token}/file/upload`;
    const form = new FormData();
    form.append('type', 1);
    form.append('file', photo.buffer, {
      filename: photo.originalname,
    });
    const headers = RecordService.generateOAuthHeaders(
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

    return this.http
      .post(host, form, {
        headers: {
          ...headers,
          ...form.getHeaders(),
        },
      })
      .pipe(pluck('data'));
  }

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
    const headers = RecordService.generateOAuthHeaders(
      server,
      pad,
      `/meglink/${pad.device_token}/record/batch_upload`,
      {},
      payload,
      {},
    );

    return this.http
      .post(host, payload, {
        headers,
      })
      .pipe(pluck('data'));
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
