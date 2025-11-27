export interface ConsensusResult {
  trendId: string;
  score: number;
  confidence: number;
  timestamp: number;
  agreement: number;
  consensusStrength: number;
  validatorResponses: ValidatorResponse[];
}

export interface ValidatorResponse {
  validatorId: string;
  request: any;
  data: {
    viralityScore: number;
    confidence: number;
    timestamp: number;
    [key: string]: any;
  };
  signature: string;
  processingTime: number;
}