export class FaceDetectMessage {
  head: string;
  score: number;
  xyxy: number[];
  tracking_id: number;
  oid: string;
  cid: string;
  frame_order: number;
  source: string;
  timestamp: number;
}
