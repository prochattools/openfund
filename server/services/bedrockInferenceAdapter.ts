export type InferenceInvocationIdentity = Readonly<{
  workspaceId: string;
  targetTransactionId: string;
}>;

export type ProviderDisabledInferenceResult = Readonly<{
  abstained: true;
  reason: 'PROVIDER_DISABLED';
}>;

export interface InferenceAdapter {
  infer(
    identity: InferenceInvocationIdentity,
  ): Promise<ProviderDisabledInferenceResult>;
}

export class DisabledBedrockInferenceAdapter implements InferenceAdapter {
  async infer(_identity: InferenceInvocationIdentity): Promise<ProviderDisabledInferenceResult> {
    return { abstained: true, reason: 'PROVIDER_DISABLED' };
  }
}
