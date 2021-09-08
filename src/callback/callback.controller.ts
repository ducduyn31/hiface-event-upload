import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';
import { CallbackService } from './callback.service';

@Controller('callback')
export class CallbackController {
  constructor(private callbackService: CallbackService) {}

  @MessagePattern('face-detected-event')
  onPhotoCaptured(message: KafkaMessage) {
    const { filename, devicename, image } = message.value as any;
    new Logger('FaceID').log(`${filename} captured at ${devicename}`);
    this.callbackService.handleEvent(filename, devicename, image);
    return 'OK';
  }
}
