import { apiRequest } from './config';

export interface NotificationDelivery {
  id: string;
  recipient: string;
  channel: 'sms' | 'email' | 'push';
  status: 'sent' | 'failed' | 'pending' | 'read' | 'delivered' | string;
  sentAt: string;
  failureReason?: string;
  messageType: string;
}

export interface NotificationStats {
  sent: number;
  failed: number;
  pending: number;
  total: number;
  successRate: number;
}

/**
 * Get notification delivery status records
 */
export async function getNotificationDeliveryStatus(
  status?: string,
  limit: number = 50,
): Promise<NotificationDelivery[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', limit.toString());

  return apiRequest<NotificationDelivery[]>(`/hq-admin/notifications/delivery-status?${params}`);
}

/**
 * Retry a failed notification
 */
export async function retryFailedNotification(notificationId: string) {
  return apiRequest(`/hq-admin/notifications/${notificationId}/retry`, {
    method: 'POST',
  });
}

/**
 * Get notification delivery statistics
 */
export async function getNotificationStats(): Promise<NotificationStats> {
  return apiRequest<NotificationStats>('/hq-admin/notifications/stats');
}
