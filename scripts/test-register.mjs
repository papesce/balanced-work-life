// Registered via `node --import` so `@/` resolves when running `node --test`.
import { register } from "node:module";

register("./test-resolve-hooks.mjs", import.meta.url);
