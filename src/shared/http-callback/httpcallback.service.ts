import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class HttpCallbackService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
  ) {}

  async getAllCallbacks() {
    try {
      const callbacks = (await this.cacheManager.get('callbacks')) as string;
      if (!callbacks) return [];
      return JSON.parse(callbacks);
    } catch (e) {
      new Logger('CallbackService').error(e);
      return [];
    }
  }

  async saveCallback(destination: string) {
    const callbacks = await this.getAllCallbacks();
    if (callbacks.includes(destination)) return;
    const newCallbacks = callbacks.push(destination);
    await this.cacheManager.set('callbacks', JSON.stringify(newCallbacks));
  }

  async deleteCallback(destination: string) {
    const callbacks = await this.getAllCallbacks();
    const findingCallbackIndex = callbacks.indexOf(destination);
    if (findingCallbackIndex === -1) return callbacks;
    const newCallbacks = callbacks.splice(findingCallbackIndex, 1);
    await this.cacheManager.set('callbacks', JSON.stringify(newCallbacks));
    return newCallbacks;
  }

  async activateAllEndpoints(payload) {
    const callbacks = await this.getAllCallbacks();
    callbacks.forEach((endpoint) =>
      this.httpService
        .post(endpoint, payload)
        .pipe(catchError(() => of(null)))
        .subscribe(),
    );
  }
}
