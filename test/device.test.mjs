import assert from 'node:assert/strict';
import { test } from 'node:test';
import deviceVerifyHandler from '../api/device/verify.js';

test('device verify handler rejects unauthenticated requests with 401', async () => {
  let statusCode = 0;
  let jsonResult = null;
  const mockReq = {
    method: 'POST',
    headers: {},
    body: { deviceId: 'test-device-id-12345' }
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          jsonResult = data;
        }
      };
    }
  };

  await deviceVerifyHandler(mockReq, mockRes);
  assert.equal(statusCode, 401);
  assert.ok(jsonResult?.error);
});

test('device verify handler rejects GET method with 405', async () => {
  let statusCode = 0;
  const mockReq = {
    method: 'GET',
    headers: {}
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return { json: () => {} };
    }
  };

  await deviceVerifyHandler(mockReq, mockRes);
  assert.equal(statusCode, 405);
});
