export class Record {
  person_id: number;
  recognition_type: RecognitionType;
  verification_mode: VerificationMode;
  pass_type: PassType;
  recognition_score: number;
  liveness_score: number;
  liveness_type: LivenessType;
}

// 1: Employee; 2: Visitor; 3: Blacklist; 4: Stranger; 5: Unidentified
export enum RecognitionType {
  NONE,
  EMPLOYEE,
  VISITOR,
  BLACKLIST,
  STRANGER,
  UNIDENTIFIED,
}

// 0: Human face; 1: Human face or credit card; 2: Human face and credit card; 3: Human face and password
export enum VerificationMode {
  FACE,
  FACE_OR_CARD,
  FACE_AND_CARD,
  FACE_AND_PASSWORD,
}

// 0: Not passed; 1: Passed
export enum PassType {
  NO_PASS,
  PASS,
}

// 0: non-living attack; 1: living 2: not detected
export enum LivenessType {
  NONLIVING,
  LIVING,
  NOT_DETECTED,
}
