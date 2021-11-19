import {
  Body,
  CACHE_MANAGER,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { CallbackService } from './callback.service';
import { Cache } from 'cache-manager';
import { FaceDetectMessage } from './requests/FaceDetectMessage';
import { HttpCallbackService } from '../shared/http-callback/httpcallback.service';

@Controller('callback')
export class CallbackController {
  constructor(
    private callbackService: CallbackService,
    private httpCallbackService: HttpCallbackService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @MessagePattern('image-transfer')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename, devicename } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    new Logger('FaceID').log(`Function deprecated, not doing anything`);
    return 'OK';
  }

  @MessagePattern('select_face')
  onFaceDetect(message: KafkaMessage) {
    const payload = message.value as any as FaceDetectMessage;
    if (payload) {
      this.callbackService.handleFaceDetectedEvent(payload);
    }
    return 'OK';
  }

  @Post('register')
  async registerCallback(@Body() payload) {
    if (!payload.destination)
      throw new HttpException('`destination` can not be empty', 400);

    await this.httpCallbackService.saveCallback(payload.destination);
    return 'OK';
  }

  @Delete('unregister')
  async unregisterCallback(@Body() payload) {
    if (!payload.destination)
      throw new HttpException('`destination` can not be empty', 400);

    return await this.httpCallbackService.deleteCallback(payload.destination);
  }

  @Get('list')
  async getAllCallbacks() {
    return await this.httpCallbackService.getAllCallbacks();
  }
}
