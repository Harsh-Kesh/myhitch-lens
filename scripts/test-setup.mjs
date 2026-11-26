// Lets plain-node tests import app code: Next.js supplies "server-only" itself, node has no such package.
import { registerHooks } from "node:module";

const stub = new URL("./server-only-stub.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: stub, format: "commonjs", shortCircuit: true };
    return next(specifier, context);
  },
});
