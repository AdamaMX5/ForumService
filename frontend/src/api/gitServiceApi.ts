import type { ForumApiAuthAdapter } from './forumApi';

// Minimal client for the GitService frontend API (see GitService.md, POST /issue) - used only by
// ReportIssueModal to let a logged-in user file an idea/bug report from within the forum.

export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: string[];
}

export interface CreateIssueResult {
  number: number;
  url: string;
}

export class GitServiceApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GitServiceApiError';
  }
}

function baseUrl(): string {
  const url = import.meta.env.VITE_GIT_SERVICE_URL;
  if (!url) throw new Error('VITE_GIT_SERVICE_URL is not configured');
  return url.replace(/\/$/, '');
}

/**
 * `auth` mirrors forumApi's `ForumApiAuthAdapter` (see AuthContext's `refreshAccessToken`) so a
 * 401 here is retried exactly once after a refresh, same as every ForumService write.
 */
export function createGitServiceApi(repo: string, auth: ForumApiAuthAdapter) {
  async function request<T>(init: RequestInit, isRetry = false): Promise<T> {
    const token = auth.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${baseUrl()}/issue`, { ...init, headers });

    if (res.status === 401 && token && !isRetry) {
      await auth.refreshAccessToken();
      return request<T>(init, true);
    }

    const text = await res.text();
    const responseBody = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        (responseBody && (responseBody.error || responseBody.message)) ||
        `GitService-Anfrage fehlgeschlagen (${res.status})`;
      throw new GitServiceApiError(res.status, message);
    }
    return responseBody as T;
  }

  return {
    createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
      if (!auth.getAccessToken()) throw new GitServiceApiError(401, 'Bitte zuerst anmelden.');
      return request<CreateIssueResult>({ method: 'POST', body: JSON.stringify({ repo, ...input }) });
    },
  };
}

export type GitServiceApi = ReturnType<typeof createGitServiceApi>;
