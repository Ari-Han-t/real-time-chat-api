module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/tests/**/*.test.js"],
  forceExit: true,
  detectOpenHandles: true,
};
