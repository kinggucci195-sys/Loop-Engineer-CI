const baseConfig = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.spec.json" }]
  },
  collectCoverageFrom: [
    "packages/**/*.ts",
    "services/**/*.ts",
    "!**/dist/**",
    "!**/*.d.ts",
    "!**/src/index.ts",
    "!**/src/cli/**"
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};

module.exports = {
  ...baseConfig,
  modulePathIgnorePatterns: ["<rootDir>/apps/web/.next"],
  testMatch: ["<rootDir>/**/__tests__/**/*.test.ts"]
};
