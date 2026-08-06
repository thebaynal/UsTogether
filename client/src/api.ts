import type { Memory } from './types';

const workspaceId = 'workspace-demo';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

function apiPath(path: string) {
  return `${apiBaseUrl}${path}`;
}

type MemoryResponse = {
  memories?: Memory[];
  memory?: Memory;
};

type CreateMemoryInput = {
  title: string;
  date: string;
  description: string;
  milestoneTag?: string;
  imageUrl: string;
  imageAlt: string;
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return (await response.json()) as T;
}

export async function loadMemories() {
  const data = await requestJson<MemoryResponse>(apiPath('/api/memories'));
  return data.memories ?? [];
}

export async function createMemory(input: CreateMemoryInput) {
  const data = await requestJson<MemoryResponse>(apiPath('/api/memories'), {
    method: 'POST',
    body: JSON.stringify({ ...input, workspaceId })
  });

  return data.memory;
}

export async function deleteMemory(id: string) {
  await fetch(apiPath(`/api/memories/${id}`), { method: 'DELETE' });
}
