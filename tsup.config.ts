import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs.js" : ".esm.js" };
  },
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  minify: false, // Keep human-readable for a dev-tools library
  target: "es2019",
  splitting: false,
  banner: {
    js: "/* react-tree-inspector v0.1.0 | MIT | https://github.com/your-org/react-tree-inspector */",
  },
});
