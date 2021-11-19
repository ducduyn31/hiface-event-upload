export class FaceDetectMessage {
  head: string;
  score: number;
  xyxy: number[];
  tracking_id: number;
  frame: string;
  source: string;
  source_id: string;
  timestamp: number;
}
