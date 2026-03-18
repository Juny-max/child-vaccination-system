import { apiRequest } from './config';

export interface HqSchedule {
  id: string;
  vaccine_id: string;
  dose_number: number;
  schedule_name: string;
  due_days_from_birth: number;
  min_age_days: number | null;
  max_age_days: number | null;
  is_mandatory: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HqVaccine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  schedules: HqSchedule[];
}

export interface CreateHqVaccinePayload {
  code: string;
  name: string;
  description?: string;
  manufacturer?: string;
}

export interface UpdateHqVaccinePayload {
  name?: string;
  description?: string;
  manufacturer?: string;
  status?: 'active' | 'archived';
}

export interface CreateHqSchedulePayload {
  vaccineId: string;
  doseNumber: number;
  scheduleName: string;
  dueDaysFromBirth: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  isMandatory?: boolean;
  sortOrder?: number;
}

export interface UpdateHqSchedulePayload {
  doseNumber?: number;
  scheduleName?: string;
  dueDaysFromBirth?: number;
  minAgeDays?: number;
  maxAgeDays?: number;
  isMandatory?: boolean;
  sortOrder?: number;
}

export async function getHqVaccines(): Promise<HqVaccine[]> {
  return apiRequest<HqVaccine[]>('/hq-admin/vaccines');
}

export async function createHqVaccine(payload: CreateHqVaccinePayload): Promise<HqVaccine> {
  return apiRequest<HqVaccine>('/hq-admin/vaccines', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqVaccine(vaccineId: string, payload: UpdateHqVaccinePayload): Promise<HqVaccine> {
  return apiRequest<HqVaccine>(`/hq-admin/vaccines/${encodeURIComponent(vaccineId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getHqSchedules(): Promise<HqSchedule[]> {
  return apiRequest<HqSchedule[]>('/hq-admin/vaccines/schedules');
}

export async function createHqSchedule(payload: CreateHqSchedulePayload): Promise<HqSchedule> {
  return apiRequest<HqSchedule>('/hq-admin/vaccines/schedules', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqSchedule(scheduleId: string, payload: UpdateHqSchedulePayload): Promise<HqSchedule> {
  return apiRequest<HqSchedule>(`/hq-admin/vaccines/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteHqSchedule(scheduleId: string): Promise<{ success: boolean; deleted: string }> {
  return apiRequest<{ success: boolean; deleted: string }>(`/hq-admin/vaccines/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'DELETE',
  });
}
