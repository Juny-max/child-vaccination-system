import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

@Injectable()
export class HqNotificationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get notification delivery status records
   */
  async getDeliveryStatus(status?: 'sent' | 'failed' | 'pending', limit: number = 50) {
    try {
      let query = this.db.supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (status === 'sent') {
        query = query.in('status', ['sent', 'delivered']);
      } else if (status) {
        query = query.eq('status', status);
      }

      const { data: notifications } = await query.limit(limit);

      return (notifications || []).map((notif) => ({
        id: notif.id,
        recipient:
          notif.recipient_contact ||
          notif.recipient_email ||
          notif.recipient_phone ||
          'Unknown recipient',
        channel: notif.channel || 'email',
        status: notif.status === 'delivered' ? 'sent' : notif.status,
        sentAt: new Date(notif.created_at).toLocaleString(),
        failureReason: notif.error_message,
        messageType: notif.template_id || 'general',
      }));
    } catch (error) {
      console.error('Failed to get notification delivery status:', error);
      return [];
    }
  }

  /**
   * Retry a failed notification
   */
  async retryNotification(id: string, user: any) {
    try {
      // First get the current retry count
      const { data: notification } = await this.db.supabase
        .from('notifications')
        .select('retry_count')
        .eq('id', id)
        .single();

      // Update notification status to pending with incremented retry count
      const { data: updated } = await this.db.supabase
        .from('notifications')
        .update({ status: 'pending', retry_count: (notification?.retry_count || 0) + 1 })
        .eq('id', id)
        .select();

      // Log the retry action
      await this.db.createAuditLog(user.id, 'update', 'notification', id, { after: { status: 'pending' } });

      return { success: true, message: 'Notification queued for retry' };
    } catch (error) {
      console.error('Failed to retry notification:', error);
      throw error;
    }
  }

  /**
   * Get notification delivery statistics
   */
  async getNotificationStats() {
    try {
      const { data: all } = await this.db.supabase.from('notifications').select('status');
      const notifications = all || [];
      const sent = notifications.filter((n) => n.status === 'sent').length;
      const failed = notifications.filter((n) => n.status === 'failed').length;
      const pending = notifications.filter((n) => n.status === 'pending').length;

      return {
        sent,
        failed,
        pending,
        total: notifications.length,
        successRate: notifications.length > 0 ? Math.round((sent / notifications.length) * 100) : 0,
      };
    } catch (error) {
      console.error('Failed to get notification stats:', error);
      return { sent: 0, failed: 0, pending: 0, total: 0, successRate: 0 };
    }
  }
}
