import { ServerInfo } from '../shared/server-info';
import { ScreenInfo } from '../shared/screen-info';
import { createHash } from 'crypto';
import * as md5 from 'md5';

export const generateSignature = (
  serverInfo: ServerInfo,
  padInfo: ScreenInfo,
  requestMethod: string,
  requestUrl: string,
  query: Record<string, any>,
  body: Record<string, string>,
  form: Record<string, string>,
  time: number,
  nonce: string,
): string => {
  const oauthToken = padInfo.user_token || padInfo.device_token;
  const oauthNonce = nonce;
  const oauthTimestamp = time;
  const oauthSignatureMethod = 'HMAC-SHA1';
  const oauthVersion = '1.0';
  const userSecret = padInfo.user_secret || serverInfo.user_secret;
  const method = requestMethod;
  const url = serverInfo.host + requestUrl;

  const payload = {
    method: encodeURIComponent(method),
    url: encodeURIComponent(url),
    [encodeURIComponent('OAuth-Nonce')]: encodeURIComponent(oauthNonce),
    [encodeURIComponent('OAuth-Timestamp')]: encodeURIComponent(
      String(oauthTimestamp),
    ),
    [encodeURIComponent('OAuth-Token')]: encodeURIComponent(oauthToken),
    [encodeURIComponent('OAuth-Signature-Method')]:
      encodeURIComponent(oauthSignatureMethod),
    [encodeURIComponent('OAuth-Version')]: encodeURIComponent(oauthVersion),
    [encodeURIComponent('user_secret')]: encodeURIComponent(userSecret),
  };

  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      payload[encodeURIComponent(key)] = encodeURIComponent(value);
    }
  });

  Object.entries(form).forEach(([key, value]) => {
    if (typeof value === 'string') {
      payload[encodeURIComponent(key)] = encodeURIComponent(value);
    }
  });

  if (body) payload.body = md5(JSON.stringify(body));

  const signatureStr = Object.keys(payload)
    .sort()
    .reduce(
      (previousSignature, currentKey) =>
        previousSignature + `${currentKey}=${payload[currentKey]}&`,
      '',
    )
    .slice(0, -1);

  return createHash('sha1').update(signatureStr).digest().toString('base64');
};
//OAuth-Nonce=f86d46a0-ec97-11eb-81a0-253cb47b3e3f&OAuth-Signature-Method=HMAC-SHA1&OAuth-Timestamp=1627142301&OAuth-Token=7138ce10-9de3-4875-8b46-59228cc842f1&OAuth-Version=1.0&body=99914b932bd37a50b983c5e7c90ae93b&method=POST&url=http%3A%2F%2F171.244.0.24%2Fmeglink%2F79e1029540b44819980c1786ebe6819e%2Ffile%2Fupload&user_secret=fdeb418f-7f42-4570-95d6-d38c267b6322
//OAuth-Nonce=f86d46a0-ec97-11eb-81a0-253cb47b3e3f&OAuth-Signature-Method=HMAC-SHA1&OAuth-Timestamp=1627142301&OAuth-Token=7138ce10-9de3-4875-8b46-59228cc842f1&OAuth-Version=1.0&file=89f752b35bdce8ec20d91a756d51f4fb&method=POST&type=1&url=http%3A%2F%2F171.244.0.24%2Fmeglink%2F79e1029540b44819980c1786ebe6819e%2Ffile%2Fupload&user_secret=fdeb418f-7f42-4570-95d6-d38c267b6322
