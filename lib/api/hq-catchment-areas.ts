import { apiRequest } from './config';

export interface HqCatchmentArea {
  id: string;
  name: string;
  code: string;
  branchId: string;
  branchName?: string | null;
  community?: string;
  populationEstimate?: number;
  assignedChwId?: string | null;
  assignedChwName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHqCatchmentAreaPayload {
  name: string;
  code: string;
  branchId: string;
  community?: string;
  populationEstimate?: number;
  assignedChwId?: string;
}

export interface UpdateHqCatchmentAreaPayload {
  name?: string;
  community?: string;
  populationEstimate?: number;
  assignedChwId?: string;
  branchId?: string;
}

export async function getHqCatchmentAreas(): Promise<HqCatchmentArea[]> {
  return apiRequest<HqCatchmentArea[]>('/hq-admin/catchment-areas');
}

export async function createHqCatchmentArea(payload: CreateHqCatchmentAreaPayload): Promise<HqCatchmentArea> {
  return apiRequest<HqCatchmentArea>('/hq-admin/catchment-areas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqCatchmentArea(
  catchmentId: string,
  payload: UpdateHqCatchmentAreaPayload
): Promise<HqCatchmentArea> {
  return apiRequest<HqCatchmentArea>(`/hq-admin/catchment-areas/${encodeURIComponent(catchmentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteHqCatchmentArea(catchmentId: string): Promise<{ success: boolean; deleted: string }> {
  return apiRequest<{ success: boolean; deleted: string }>(`/hq-admin/catchment-areas/${encodeURIComponent(catchmentId)}`, {
    method: 'DELETE',
  });
}
