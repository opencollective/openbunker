// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = jest.fn();

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
