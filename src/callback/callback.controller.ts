import { CACHE_MANAGER, Controller, Inject, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { CallbackService } from './callback.service';
import { Cache } from 'cache-manager';

@Controller('callback')
export class CallbackController {
  constructor(
    private callbackService: CallbackService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @MessagePattern('face-detected-event')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename, devicename, image } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    this.callbackService.handlePhotoCapturedEvent(filename, devicename, image);
    return 'OK';
  }

  @MessagePattern('post_process')
  async onFaceDetect(message: KafkaMessage) {
    const { object_id, detection, frame, source } = message.value as any;
    const bbox = detection.bbox.map((point) => Math.floor(point));
    new Logger('FaceID').log(`Face detected from ${source}`);
    await this.callbackService.handleDetectedEvent(frame, bbox, source);
    return 'OK';
  }
}
