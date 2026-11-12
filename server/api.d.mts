export interface AiStatus {
  enabled: boolean;
  provider: string;
  textModel: string;
  visionModel: string;
}

export function handleApiRequest(
  req: unknown,
  res: unknown,
  url?: URL,
): Promise<void>;

export function getAiStatus(): AiStatus;
