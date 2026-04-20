import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test ApiClient directly by constructing it — no need to mock the exported singleton
import { ApiClient } from '@/services/api';

describe('ApiClient', () => {
  const baseUrl = 'https://test-api.example.com';
  let client: InstanceType<typeof ApiClient>;

  beforeEach(() => {
    client = new ApiClient(baseUrl);
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('stores the base URL', () => {
      expect((client as any).baseUrl).toBe(baseUrl);
    });
  });

  describe('request', () => {
    it('makes GET request to correct URL', async () => {
      const mockResponse = { data: 'test' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await client.request('/api/test');
      expect(fetch).toHaveBeenCalledWith(
        'https://test-api.example.com/api/test',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual(mockResponse);
    });

    it('includes Authorization header when token is provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await client.request('/api/test', 'GET', 'my-token-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token-123',
          }),
        })
      );
    });

    it('does not include Authorization header when no token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await client.request('/api/test', 'GET');

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('sends JSON body for POST requests', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      const body = { username: 'test', password: '123' };
      await client.request('/api/auth', 'POST', null, body);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('sets Content-Type to application/json', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      await client.request('/api/test');

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });

    it('throws error with message from response body on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid request' }),
      } as Response);

      await expect(client.request('/api/test')).rejects.toThrow('Invalid request');
    });

    it('throws generic error when response body has no error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response);

      await expect(client.request('/api/test')).rejects.toThrow('Request failed: 500');
    });

    it('throws generic error when JSON parsing fails on error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      await expect(client.request('/api/test')).rejects.toThrow('Request failed: 503');
    });

    it('uses message field when error field is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      } as Response);

      await expect(client.request('/api/test')).rejects.toThrow('Unauthorized');
    });
  });
});