import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseAdminClient } from '../admin/supabase-client';

const fetchMock = vi.fn<typeof fetch>();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset(); });

describe('Supabase admin client security boundary', () => {
    it('accepts HTTPS and local development URLs only', () => {
        expect(() => new SupabaseAdminClient('https://project.supabase.co', 'sb_publishable_test')).not.toThrow();
        expect(() => new SupabaseAdminClient('http://127.0.0.1:54321', 'sb_publishable_test')).not.toThrow();
        expect(() => new SupabaseAdminClient('http://project.supabase.co', 'sb_publishable_test')).toThrow('必須使用 HTTPS');
        expect(() => new SupabaseAdminClient('https://user:password@project.supabase.co', 'sb_publishable_test')).toThrow('不可嵌入帳密');
        expect(() => new SupabaseAdminClient('https://project.supabase.co/path', 'sb_publishable_test')).toThrow('不可嵌入帳密');
    });

    it('uses the AAL1 token only for MFA setup, then sends the upgraded token to admin RPCs', async () => {
        fetchMock
            .mockResolvedValueOnce(json({ access_token: 'aal1-token', refresh_token: 'refresh-1', expires_in: 3600, token_type: 'bearer' }))
            .mockResolvedValueOnce(json({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] }))
            .mockResolvedValueOnce(json({ id: 'factor-new', totp: { qr_code: '<svg/>', secret: 'secret', uri: 'otpauth://totp/test' } }))
            .mockResolvedValueOnce(json({ id: 'challenge-1' }))
            .mockResolvedValueOnce(json({ access_token: 'aal2-token', refresh_token: 'refresh-2', expires_in: 3600, token_type: 'bearer' }))
            .mockResolvedValueOnce(json(true));

        const client = new SupabaseAdminClient('https://project.supabase.co', 'sb_publishable_test');
        const factors = await client.signIn('admin@example.test', 'password');
        expect(factors).toHaveLength(1);
        await client.enrollTotp();
        await client.verifyTotp('factor-new', '123456');
        await expect(client.isContentAdmin()).resolves.toBe(true);

        const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
        const firstHeaders = new Headers(calls[0][1]?.headers);
        const factorHeaders = new Headers(calls[1][1]?.headers);
        const rpcHeaders = new Headers(calls[5][1]?.headers);
        expect(firstHeaders.has('Authorization')).toBe(false);
        expect(firstHeaders.get('apikey')).toBe('sb_publishable_test');
        expect(calls[1][0]).toBe('https://project.supabase.co/auth/v1/user');
        expect(factorHeaders.get('Authorization')).toBe('Bearer aal1-token');
        expect(rpcHeaders.get('Authorization')).toBe('Bearer aal2-token');
    });

    it('requires an authenticated session before removing an MFA factor', async () => {
        fetchMock
            .mockResolvedValueOnce(json({ access_token: 'admin-token', refresh_token: 'refresh-1', expires_in: 3600, token_type: 'bearer' }))
            .mockResolvedValueOnce(json({ all: [] }))
            .mockResolvedValueOnce(json({ id: 'factor-1' }));
        const client = new SupabaseAdminClient('https://project.supabase.co', 'sb_publishable_test');
        await client.signIn('admin@example.test', 'password');
        await client.unenrollTotp('factor-1');
        const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
        const deletion = calls[2];
        expect(deletion[0]).toBe('https://project.supabase.co/auth/v1/factors/factor-1');
        expect(deletion[1]?.method).toBe('DELETE');
        expect(new Headers(deletion[1]?.headers).get('Authorization')).toBe('Bearer admin-token');
    });

    it('reports the failing method and path without exposing query parameters', async () => {
        fetchMock
            .mockResolvedValueOnce(json({ access_token: 'aal1-token', refresh_token: 'refresh-1', expires_in: 3600, token_type: 'bearer' }))
            .mockResolvedValueOnce(json({ message: 'Method not allowed' }, 405));
        const client = new SupabaseAdminClient('https://project.supabase.co', 'sb_publishable_test');
        await expect(client.signIn('admin@example.test', 'password')).rejects.toThrow(
            'GET /auth/v1/user（HTTP 405）：Method not allowed'
        );
    });
});
