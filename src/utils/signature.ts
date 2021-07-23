import { Request } from 'express';

export const generateSignature = (request: Request): string => {
  return urlRoot(request);
};

const urlRoot = (request: Request): string => {
  const url = request.protocol + '://' + request.get('host');
  return url;
};
