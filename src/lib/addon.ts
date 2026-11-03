import type { RawAgmsgRecord } from "../types";
import {
  type AddonInit,
  type AddonMessage,
  connect,
} from "../vendor/agmsg-addon.js";

// True in the build that runs as a pane of the agmsg desktop app.
export const IS_ADDON = import.meta.env.MODE === "addon";

export interface AddonHandlers {
  onInit: (init: AddonInit) => void;
  onMessage: (message: AddonMessage) => void;
}

let handlers: AddonHandlers | undefined;
let connected = false;

// The kit's connect() has no teardown, so it runs once per page and forwards to
// whichever handlers the app registered last.
export function connectAddon(nextHandlers: AddonHandlers): void {
  handlers = nextHandlers;
  if (connected) return;
  connected = true;
  connect({
    onInit: (init) => handlers?.onInit(init),
    onMessage: (message) => handlers?.onMessage(message),
  });
}

export function toRawRecord(message: AddonMessage): RawAgmsgRecord {
  return {
    id: message.id,
    team: message.team,
    from_agent: message.from,
    to_agent: message.to,
    body: message.body,
    created_at: message.created_at,
  };
}
