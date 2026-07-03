import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: ["**/dist/**", "**/.next/**", "coverage/**", "node_modules/**"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly"
      },
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": "error"
    }
  },
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        jest: "readonly"
      }
    }
  },
  {
    files: ["**/*.config.{js,mjs}", "jest.config.js"],
    languageOptions: {
      globals: {
        module: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
);
