// BASE_URL is "/" for the regular app and "./" for the add-on build, which is
// served from a folder inside the agmsg desktop app.
export const BASE_PATH = import.meta.env.BASE_URL;
export const ASSET_BASE = `${BASE_PATH}assets/`;
