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
let pendingInit: AddonInit | undefined;
let pendingMessages: AddonMessage[] = [];

// The app posts the port right after the frame's load event, which can come
// before React has rendered, so listening must start when this module loads.
// What arrives before the app registers its handlers waits here.
if (IS_ADDON) {
  connect({
    // Falling back to sample data would discard a port that arrives later.
    sample: import.meta.env.DEV,
    onInit: (init) => {
      if (handlers) {
        handlers.onInit(init);
        return;
      }
      pendingInit = init;
      pendingMessages = [];
    },
    onMessage: (message) => {
      if (handlers) {
        handlers.onMessage(message);
        return;
      }
      pendingMessages.push(message);
    },
  });
}

export function registerAddonHandlers(nextHandlers: AddonHandlers): void {
  handlers = nextHandlers;
  if (pendingInit) handlers.onInit(pendingInit);
  for (const message of pendingMessages) handlers.onMessage(message);
  pendingInit = undefined;
  pendingMessages = [];
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
