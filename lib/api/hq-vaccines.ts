import { apiRequest } from './config';

export interface HqVaccine {
  id: string;
  name: string;
  schedule: string;
  dueDays: number;
  status: 'active' | 'archived';
}

export interface CreateHqVaccinePayload {
  name: string;
  schedule?: string;
  dueDays?: number;
}

export interface UpdateHqVaccinePayload {
  name?: string;
  schedule?: string;
  dueDays?: number;
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
  dosage: string;
  ageMonths: number;
  route: string;
}

export interface UpdateHqSchedulePayload {
  dosage?: string;
  ageMonths?: number;
  route?: string;
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
