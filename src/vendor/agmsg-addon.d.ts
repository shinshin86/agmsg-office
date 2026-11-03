export interface AddonMember {
  name: string;
  type: string;
}

export interface AddonMessage {
  id: string;
  team: string;
  from: string;
  to: string;
  body: string;
  created_at: string;
  truncated?: true;
}

export interface AddonInit {
  team: string;
  members: AddonMember[];
  messages: AddonMessage[];
}

export interface AddonConnection {
  readonly inApp: boolean;
  readonly sample: boolean;
}

export function connect(options?: {
  onInit?: (init: AddonInit) => void;
  onMessage?: (message: AddonMessage) => void;
  sample?: boolean;
  sampleAfterMs?: number;
  errorOverlay?: boolean;
}): AddonConnection;
