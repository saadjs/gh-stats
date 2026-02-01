import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules, createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const builtins = builtinModules.flatMap((moduleName) =>
  moduleName.startsWith("node:")
    ? [moduleName, moduleName.slice("node:".length)]
    : [moduleName, `node:${moduleName}`]
);

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      outDir: "dist",
      tsconfigPath: "tsconfig.json",
      rollupTypes: true,
      exclude: ["src/__tests__/**"],
    }),
  ],
  build: {
    target: "node22",
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        cli: path.resolve(__dirname, "src/cli.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [...builtins, ...Object.keys(pkg.dependencies ?? {})],
      output: {
        banner: (chunk) => (chunk.isEntry && chunk.name === "cli" ? "#!/usr/bin/env node" : ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/__tests__/"],
    },
  },
});
