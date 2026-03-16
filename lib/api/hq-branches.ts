import { apiRequest } from './config';

export interface HqBranch {
  id: string;
  dbId: string;
  name: string;
  region: string;
  manager: string;
  status: 'active' | 'inactive';
  catchmentAreas: string[];
  assignedChws: string[];
}

export interface UpsertHqBranchPayload {
  name: string;
  region: string;
  manager?: string;
  catchmentAreas: string[];
}

export async function getHqBranches(): Promise<HqBranch[]> {
  return apiRequest<HqBranch[]>('/hq-admin/branches');
}

export async function createHqBranch(payload: UpsertHqBranchPayload): Promise<HqBranch> {
  return apiRequest<HqBranch>('/hq-admin/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqBranch(code: string, payload: UpsertHqBranchPayload): Promise<HqBranch> {
  return apiRequest<HqBranch>(`/hq-admin/branches/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateHqBranchStatus(code: string, status: 'active' | 'inactive'): Promise<HqBranch> {
  return apiRequest<HqBranch>(`/hq-admin/branches/${encodeURIComponent(code)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function updateHqBranchChws(code: string, assignedChws: string[]): Promise<HqBranch> {
  return apiRequest<HqBranch>(`/hq-admin/branches/${encodeURIComponent(code)}/chws`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedChws }),
  });
}
