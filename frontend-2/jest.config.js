/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        // The app tsconfig keeps `jsx: preserve` for Next; tests need a real
        // transform so ts-jest can compile .tsx files.
        tsconfig: { jsx: 'react-jsx', esModuleInterop: true, strict: true },
      },
    ],
  },
  collectCoverageFrom: ['src/lib/**/*.ts', 'src/services/**/*.ts'],
};
