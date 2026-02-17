import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private _supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    // Prefer service role key for backend (bypasses RLS), fallback to anon key
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') 
      || this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const isServiceRole = !!this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    console.log(`🔑 Using ${isServiceRole ? 'SERVICE ROLE' : 'ANON'} key for Supabase`);

    this._supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    console.log('✅ Supabase client initialized');
  }

  /**
   * Get the Supabase client instance (for direct queries)
   */
  get supabase(): SupabaseClient {
    return this._supabase;
  }

  /**
   * Query helper - wraps Supabase query with error handling
   */
  async query<T>(
    tableName: string,
    queryFn: (query: ReturnType<SupabaseClient['from']>) => Promise<{ data: T | null; error: any }>,
  ): Promise<T> {
    const query = this._supabase.from(tableName);
    const { data, error } = await queryFn(query);

    if (error) {
      console.error(`Database error on ${tableName}:`, error);
      throw new Error(error.message);
    }

    return data as T;
  }

  // =========================================================================
  // PARENT PORTAL QUERIES
  // =========================================================================

  /**
   * Get guardian by user ID (for authenticated parent)
   */
  async getGuardianByUserId(userId: string) {
    const { data, error } = await this._supabase
      .from('guardians')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Get all children for a guardian
   */
  async getChildrenByGuardianId(guardianId: string) {
    const { data, error } = await this._supabase
      .from('child_guardian')
      .select(`
        relationship,
        is_primary,
        child:children (
          id,
          cvcc_id,
          qr_code_payload,
          full_name,
          date_of_birth,
          gender,
          birth_weight,
          birth_length,
          blood_type,
          profile_photo_url,
          allergies,
          critical_notes,
          is_active,
          primary_facility:branches (
            id,
            name,
            address,
            phone
          )
        )
      `)
      .eq('guardian_id', guardianId);

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Get vaccination history for a child
   */
  async getVaccinationHistory(childId: string) {
    const { data, error } = await this._supabase
      .from('vaccination_events')
      .select(`
        id,
        dose_number,
        administered_date,
        batch_number,
        status,
        notes,
        vaccine:vaccines (
          id,
          code,
          name,
          description
        ),
        administered_by:users (
          id,
          full_name
        ),
        facility:branches (
          id,
          name
        )
      `)
      .eq('child_id', childId)
      .order('administered_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Get upcoming vaccination schedule for a child
   */
  async getUpcomingVaccinations(childId: string, dateOfBirth: string) {
    // Get all schedules
    const { data: schedules, error: scheduleError } = await this._supabase
      .from('vaccination_schedules')
      .select(`
        id,
        dose_number,
        schedule_name,
        due_days_from_birth,
        is_mandatory,
        vaccine:vaccines (
          id,
          code,
          name,
          description
        )
      `)
      .order('sort_order');

    if (scheduleError) throw new Error(scheduleError.message);

    // Get completed vaccinations
    const { data: completed, error: completedError } = await this._supabase
      .from('vaccination_events')
      .select('vaccine_id, dose_number')
      .eq('child_id', childId)
      .eq('status', 'completed');

    if (completedError) throw new Error(completedError.message);

    // Calculate due dates and filter upcoming
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const completedSet = new Set(
      completed?.map((c) => `${c.vaccine_id}-${c.dose_number}`) || [],
    );

    return schedules
      ?.filter((s) => {
        const vaccine = s.vaccine as unknown as { id: string; code: string; name: string; description: string } | null;
        const key = `${vaccine?.id}-${s.dose_number}`;
        return !completedSet.has(key);
      })
      .map((s) => {
        const dueDate = new Date(birthDate);
        dueDate.setDate(dueDate.getDate() + s.due_days_from_birth);
        const daysOverdue = Math.floor(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          ...s,
          dueDate: dueDate.toISOString().split('T')[0],
          isOverdue: daysOverdue > 0,
          daysOverdue: Math.max(0, daysOverdue),
        };
      });
  }

  /**
   * Get certificates for a child
   */
  async getCertificates(childId: string) {
    const { data, error } = await this._supabase
      .from('certificates')
      .select(`
        id,
        certificate_id,
        qr_payload,
        issued_date,
        completion_status,
        vaccines_completed,
        pdf_url,
        status,
        last_verified_at,
        issued_by_user_id,
        issued_by_facility_id
      `)
      .eq('child_id', childId)
      .order('issued_date', { ascending: false });

    if (error) throw new Error(error.message);
    
    // Fetch related user and facility data separately if needed
    if (data && data.length > 0) {
      // Get unique user IDs and facility IDs
      const userIds = [...new Set(data.map(c => c.issued_by_user_id).filter(Boolean))];
      const facilityIds = [...new Set(data.map(c => c.issued_by_facility_id).filter(Boolean))];
      
      // Fetch users
      const usersMap = new Map();
      if (userIds.length > 0) {
        const { data: users } = await this._supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds);
        users?.forEach(u => usersMap.set(u.id, u));
      }
      
      // Fetch facilities
      const facilitiesMap = new Map();
      if (facilityIds.length > 0) {
        const { data: facilities } = await this._supabase
          .from('branches')
          .select('id, name')
          .in('id', facilityIds);
        facilities?.forEach(f => facilitiesMap.set(f.id, f));
      }
      
      // Map the data with related entities
      return data.map(cert => ({
        ...cert,
        issued_by: usersMap.get(cert.issued_by_user_id) || null,
        facility: facilitiesMap.get(cert.issued_by_facility_id) || null,
      }));
    }
    
    return data;
  }

  /**
   * Get appointments for guardian's children
   */
  async getAppointments(guardianId: string) {
    const { data, error } = await this._supabase
      .from('appointments')
      .select(`
        id,
        scheduled_date,
        scheduled_time,
        status,
        notes,
        child:children (
          id,
          cvcc_id,
          full_name
        ),
        vaccine:vaccines (
          id,
          name
        ),
        facility:branches (
          id,
          name,
          address,
          phone
        )
      `)
      .eq('guardian_id', guardianId)
      .order('scheduled_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Get notifications for a guardian
   */
  async getNotifications(guardianId: string, limit = 20) {
    const { data, error } = await this._supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', guardianId)
      .eq('recipient_type', 'guardian')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      const message = error.message || '';
      const isRecipientTypeMismatch =
        message.toLowerCase().includes('recipient_type') ||
        message.toLowerCase().includes('column') ||
        message.toLowerCase().includes('schema cache');

      if (isRecipientTypeMismatch) {
        const { data: fallbackData, error: fallbackError } = await this._supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', guardianId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fallbackError) throw new Error(fallbackError.message);
        return fallbackData;
      }

      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get missed vaccinations for all children of a guardian
   */
  async getMissedVaccinations(guardianId: string) {
    // Get all children for this guardian
    const childRelations = await this.getChildrenByGuardianId(guardianId);

    const missedVaccinations: Array<{
      childId: string;
      childName: string;
      vaccine: string;
      dueDate: string;
      daysOverdue: number;
    }> = [];

    for (const relation of childRelations || []) {
      const child = relation.child as any;
      if (!child) continue;

      const upcoming = await this.getUpcomingVaccinations(
        child.id,
        child.date_of_birth,
      );

      const overdue = upcoming?.filter((v) => v.isOverdue) || [];

      for (const vax of overdue) {
        const vaccine = vax.vaccine as unknown as { id: string; code: string; name: string; description: string } | null;
        missedVaccinations.push({
          childId: child.id,
          childName: child.full_name,
          vaccine: vaccine?.name || 'Unknown',
          dueDate: vax.dueDate,
          daysOverdue: vax.daysOverdue,
        });
      }
    }

    return missedVaccinations;
  }

  // =========================================================================
  // AUTHENTICATION QUERIES
  // =========================================================================

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const { data, error } = await this._supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    return data;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const { data, error } = await this._supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string) {
    const { error } = await this._supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw new Error(error.message);
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details?: { before?: any; after?: any; ip?: string; userAgent?: string },
  ) {
    const { error } = await this._supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_data: details?.before,
      after_data: details?.after,
      ip_address: details?.ip,
      user_agent: details?.userAgent,
      category: 'clinical',
    });

    if (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Get vaccination completion status for a child
   * Returns the total required vaccines and completed count
   */
  async getVaccinationCompletionStatus(childId: string): Promise<{
    totalRequired: number;
    completedCount: number;
    isComplete: boolean;
    completedVaccines: string[];
  }> {
    // Get total mandatory vaccines from schedule
    const { data: schedules, error: scheduleError } = await this._supabase
      .from('vaccination_schedules')
      .select('id, vaccine:vaccines(id, name)')
      .eq('is_mandatory', true);

    if (scheduleError) throw new Error(scheduleError.message);

    const totalRequired = schedules?.length || 0;

    // Get completed vaccinations for this child
    const { data: completed, error: completedError } = await this._supabase
      .from('vaccination_events')
      .select(`
        id,
        vaccine_id,
        dose_number,
        vaccine:vaccines(id, name)
      `)
      .eq('child_id', childId)
      .eq('status', 'completed');

    if (completedError) throw new Error(completedError.message);

    const completedCount = completed?.length || 0;
    const completedVaccines = completed?.map((v: any) => v.vaccine?.name).filter(Boolean) || [];

    return {
      totalRequired,
      completedCount,
      isComplete: completedCount >= totalRequired && totalRequired > 0,
      completedVaccines,
    };
  }
}
