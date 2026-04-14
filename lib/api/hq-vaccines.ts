import { apiRequest } from './config';

export interface HqVaccine {
  id: string;
  code?: string;
  name: string;
  schedule: string;
  dueDays: number;
  status: 'active' | 'archived';
}

export interface CreateHqVaccinePayload {
  name: string;
  schedule?: string;
  dueDays?: number;
  code: string;
  description?: string;
  manufacturer?: string;
}

export interface UpdateHqVaccinePayload {
  name?: string;
  schedule?: string;
  dueDays?: number;
  description?: string;
  manufacturer?: string;
  status?: string;
}

export interface HqSchedule {
  id: string;
  vaccineId: string;
  vaccineName: string;
  dosage: string;
  ageMonths: number;
  route: string;
  status: 'active' | 'archived';
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
  dosage?: string;
  ageMonths?: number;
  route?: string;
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

export async function deleteHqVaccine(vaccineId: string): Promise<{ success: boolean; deleted: string }> {
  return apiRequest<{ success: boolean; deleted: string }>(`/hq-admin/vaccines/${encodeURIComponent(vaccineId)}`, {
    method: 'DELETE',
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
