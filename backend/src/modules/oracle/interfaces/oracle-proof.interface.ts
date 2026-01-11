export interface OracleProof {
  hash: string;
  merkleRoot: string;
  signatures: ValidatorSignature[];
  payload: ProofPayload;
}

export interface ValidatorSignature {
  validatorId: string;
  signature: string;
  timestamp: number;
  publicKey?: string;
}

export interface ProofPayload {
  trendId: string;
  score: number;
  confidence: number;
  timestamp: number;
  validators: string[];
  dataType?: string;
  sourceHash?: string;
}

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}
