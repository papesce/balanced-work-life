import { version as pkgVersion } from "../../package.json";

export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || pkgVersion;
