import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tsFiles = ["**/*.ts", "**/*.tsx"];
const tsRecommended = tseslint.configs["flat/recommended"].map((config) => ({
  ...config,
  files: tsFiles,
}));

export default [
  {
    ignores: ["dist/**", "node_modules/**", ".eslintrc.cjs"],
  },
  ...tsRecommended,
  {
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  prettier,
];
