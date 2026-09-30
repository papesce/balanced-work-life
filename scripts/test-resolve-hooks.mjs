// Node module hooks mapping the `@/` tsconfig alias to ./src for `node --test`.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const srcUrl = pathToFileURL(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src") + "/",
).href;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    let mapped = srcUrl + specifier.slice(2);
    if (!/\.[a-z]+$/i.test(mapped)) mapped += ".ts";
    return next(mapped, context);
  }
  // Extensionless relative imports resolve to .ts sources under node --test.
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    try {
      return await next(specifier, context);
    } catch (err) {
      if (err?.code === "ERR_MODULE_NOT_FOUND" && !/\.[a-z]+$/i.test(specifier)) {
        return next(specifier + ".ts", context);
      }
      throw err;
    }
  }
  return next(specifier, context);
}
