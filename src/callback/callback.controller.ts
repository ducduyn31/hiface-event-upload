import { CACHE_MANAGER, Controller, Inject, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { CallbackService } from './callback.service';
import { Cache } from 'cache-manager';
import { FaceDetectMessage } from './requests/FaceDetectMessage';

@Controller('callback')
export class CallbackController {
  constructor(
    private callbackService: CallbackService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
  }

  @MessagePattern('image-transfer')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename, devicename, image } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    this.callbackService.handlePhotoCapturedEvent(filename, devicename, image);
    return 'OK';
  }

  @MessagePattern('select_face')
  async onFaceDetect(message: KafkaMessage) {
    const payload = message.value as any as FaceDetectMessage;
    if (payload) {
      await this.callbackService.handleFaceDetectedEvent(payload);
    }
    return 'OK';
  }
}
