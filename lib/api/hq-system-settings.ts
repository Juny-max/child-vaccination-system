import { apiRequest } from './config';

export interface HqSystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  readOnly: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateHqSystemSettingPayload {
  key: string;
  value: string;
  category: string;
  description?: string;
}

export interface UpdateHqSystemSettingPayload {
  value?: string;
  description?: string;
}

export async function getHqSystemSettings(): Promise<HqSystemSetting[]> {
  return apiRequest<HqSystemSetting[]>('/hq-admin/system-settings');
}

export async function createHqSystemSetting(payload: CreateHqSystemSettingPayload): Promise<HqSystemSetting> {
  return apiRequest<HqSystemSetting>('/hq-admin/system-settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqSystemSetting(
  settingId: string,
  payload: UpdateHqSystemSettingPayload
): Promise<HqSystemSetting> {
  return apiRequest<HqSystemSetting>(`/hq-admin/system-settings/${encodeURIComponent(settingId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
