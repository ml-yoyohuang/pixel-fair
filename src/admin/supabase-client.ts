export type ContentDocument = {
    collection: string;
    id: string;
    event_id: string;
    data: Record<string, unknown>;
    is_published: boolean;
    revision: number;
    updated_at: string;
};
export type ContentAuditEntry = {
    id: number;
    actor_id: string | null;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    event_id: string;
    collection: string;
    document_id: string;
    old_document: unknown;
    new_document: unknown;
    occurred_at: string;
};

type AuthSession = {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type: string;
};
type AuthSessionPayload = Omit<AuthSession, 'expires_at'> & { expires_at?: number; expires_in?: number };

export type TotpFactor = { id: string; factor_type: string; status: string; friendly_name?: string };

export class SupabaseAdminClient {
    private session: AuthSession | null = null;
    private refreshPromise: Promise<void> | null = null;
    private readonly baseUrl: string;

    constructor(url: string, private readonly publicKey: string) {
        let parsed: URL;
        try { parsed = new URL(url); } catch { throw new Error('Supabase 專案網址格式不正確。'); }
        const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
        if (parsed.protocol !== 'https:' && !local) {
            throw new Error('Supabase 網址必須使用 HTTPS（本機 localhost 除外）。');
        }
        if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error('Supabase 專案網址只能包含 origin，不可嵌入帳密或額外路徑。');
        this.baseUrl = parsed.origin;
        if (!publicKey) throw new Error('缺少 Supabase publishable key。');
    }

    private rememberSession(payload: AuthSessionPayload) {
        this.session = {
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            token_type: payload.token_type,
            expires_at: payload.expires_at ?? Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600)
        };
    }

    private async request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
        if (authenticated) await this.ensureFreshSession();
        const headers = new Headers(init.headers);
        headers.set('apikey', this.publicKey);
        headers.set('Accept', 'application/json');
        if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        if (authenticated) {
            if (!this.session) throw new Error('登入已逾時，請重新登入。');
            headers.set('Authorization', `Bearer ${this.session.access_token}`);
        }
        try {
            const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(10000) });
            const body = response.status === 204 ? null : await response.json().catch(() => null);
            if (!response.ok) {
                const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : `Supabase 請求失敗（HTTP ${response.status}）。`;
                const method = (init.method ?? 'GET').toUpperCase();
                const safePath = path.split('?')[0];
                throw new Error(`${method} ${safePath}（HTTP ${response.status}）：${message}`);
            }
            return body as T;
        } catch (error) {
            if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('連線逾時，請檢查網路後重試。');
            throw error;
        }
    }

    async signIn(email: string, password: string) {
        const session = await this.request<AuthSessionPayload>('/auth/v1/token?grant_type=password', {
            method: 'POST', body: JSON.stringify({ email, password })
        });
        this.rememberSession(session);
        return this.listFactors();
    }

    async listFactors(): Promise<TotpFactor[]> {
        // Supabase's MFA SDK reads factors from the authenticated user response.
        // There is no GET /auth/v1/factors route; that route is for POST enroll.
        const user = await this.request<{ factors?: TotpFactor[] }>('/auth/v1/user', {}, true);
        return (user.factors ?? []).filter(factor => factor.factor_type === 'totp');
    }

    async enrollTotp() {
        return this.request<{ id: string; totp: { qr_code: string; secret: string; uri: string } }>('/auth/v1/factors', {
            method: 'POST', body: JSON.stringify({ factor_type: 'totp', friendly_name: `Pixel Fair Admin ${new Date().toISOString()}` })
        }, true);
    }

    async verifyTotp(factorId: string, code: string) {
        const challenge = await this.request<{ id: string }>(`/auth/v1/factors/${encodeURIComponent(factorId)}/challenge`, {
            method: 'POST', body: JSON.stringify({})
        }, true);
        const session = await this.request<AuthSessionPayload>(`/auth/v1/factors/${encodeURIComponent(factorId)}/verify`, {
            method: 'POST', body: JSON.stringify({ challenge_id: challenge.id, code })
        }, true);
        this.rememberSession(session);
    }

    async unenrollTotp(factorId: string) {
        await this.request(`/auth/v1/factors/${encodeURIComponent(factorId)}`, { method: 'DELETE' }, true);
    }

    async documents(): Promise<ContentDocument[]> {
        const pageSize = 1000;
        const documents: ContentDocument[] = [];
        for (let offset = 0; ; offset += pageSize) {
            const query = `?select=collection,id,event_id,data,is_published,revision,updated_at&order=collection.asc,id.asc&limit=${pageSize}&offset=${offset}`;
            const page = await this.request<ContentDocument[]>(`/rest/v1/content_documents${query}`, {}, true);
            documents.push(...page);
            if (page.length < pageSize) return documents;
        }
    }

    async isContentAdmin(): Promise<boolean> {
        return this.request<boolean>('/rest/v1/rpc/is_content_admin', {
            method: 'POST', body: JSON.stringify({})
        }, true);
    }

    async auditLog(): Promise<ContentAuditEntry[]> {
        const query = '?select=id,actor_id,action,event_id,collection,document_id,old_document,new_document,occurred_at&order=occurred_at.desc,id.desc&limit=100';
        return this.request<ContentAuditEntry[]>(`/rest/v1/content_audit_log${query}`, {}, true);
    }

    async saveDocument(document: Pick<ContentDocument, 'collection' | 'id' | 'event_id' | 'data' | 'is_published'>, expectedRevision?: number) {
        if (expectedRevision === undefined) {
            await this.request('/rest/v1/content_documents', {
                method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(document)
            }, true);
            return;
        }
        const query = `?event_id=eq.${encodeURIComponent(document.event_id)}&collection=eq.${encodeURIComponent(document.collection)}&id=eq.${encodeURIComponent(document.id)}&revision=eq.${expectedRevision}`;
        const rows = await this.request<ContentDocument[]>(`/rest/v1/content_documents${query}`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ event_id: document.event_id, data: document.data, is_published: document.is_published })
        }, true);
        if (rows.length === 0) throw new Error('這份資料已被另一個分頁修改。請重新載入後再編輯，避免覆蓋新內容。');
    }

    async importDocuments(documents: Pick<ContentDocument, 'collection' | 'id' | 'event_id' | 'data' | 'is_published'>[]) {
        return this.request<number>('/rest/v1/rpc/import_content_documents', {
            method: 'POST',
            body: JSON.stringify({ p_documents: documents })
        }, true);
    }

    async deleteDocument(eventId: string, collection: string, id: string, expectedRevision?: number) {
        const revision = expectedRevision === undefined ? '' : `&revision=eq.${expectedRevision}`;
        const query = `?event_id=eq.${encodeURIComponent(eventId)}&collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}${revision}`;
        const rows = await this.request<ContentDocument[]>(`/rest/v1/content_documents${query}`, {
            method: 'DELETE', headers: { Prefer: 'return=representation' }
        }, true);
        if (rows.length === 0) throw new Error('資料已變更或已刪除。請重新載入清單後再操作。');
    }

    async signOut() {
        try { await this.request('/auth/v1/logout', { method: 'POST', body: JSON.stringify({}) }, true); }
        finally { this.session = null; }
    }

    private async ensureFreshSession() {
        if (!this.session) throw new Error('請重新登入。');
        if (this.session.expires_at - Math.floor(Date.now() / 1000) > 45) return;
        if (!this.refreshPromise) {
            this.refreshPromise = (async () => {
                if (!this.session) throw new Error('請重新登入。');
                const refreshed = await this.request<AuthSessionPayload>('/auth/v1/token?grant_type=refresh_token', {
                    method: 'POST', body: JSON.stringify({ refresh_token: this.session.refresh_token })
                });
                this.rememberSession(refreshed);
            })().finally(() => { this.refreshPromise = null; });
        }
        await this.refreshPromise;
    }
}
