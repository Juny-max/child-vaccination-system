import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { QrTokenService } from '../common/qr-token.service';
import {
  SyncCHWVaccinationsDto,
  SyncResultDto,
  CHWVaccinationDto,
} from './dto';

type ChwOfflineChild = {
  id: string;
  cvccId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  primaryFacilityId?: string;
  catchmentAreaId: string;
  guardianName?: string;
  guardianPhone?: string;
  updatedAt: string;
};

type AssignedChild = {
  id: string;
  cvccId: string;
  qrPayload?: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  primaryFacilityId?: string;
  guardianName?: string;
  guardianPhone?: string;
  village?: string;
  catchmentAreaId: string;
};

type ChwOfflineRegistrationPayload = {
  guardianId?: string;
  motherName: string;
  motherPhone: string;
  childName: string;
  childDob: string;
  childGender?: string;
};

type ChwRegistrationContext = {
  branchId: string | null;
  catchmentAreaId: string | null;
  community: string | null;
};

@Injectable()
export class ChwService {
  private readonly logger = new Logger(ChwService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly qrTokenService: QrTokenService,
  ) {}

  private toChildArray(rawChild: any): any[] {
    if (!rawChild) {
      return [];
    }
    return Array.isArray(rawChild) ? rawChild : [rawChild];
  }

  private readVaccineName(vaccine: any): string | undefined {
    if (Array.isArray(vaccine)) {
      return vaccine[0]?.name;
    }
    return vaccine?.name;
  }

  private readVaccineId(vaccine: any): string | undefined {
    if (Array.isArray(vaccine)) {
      return vaccine[0]?.id;
    }
    return vaccine?.id;
  }

  private toReadableDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private toAgeLabel(dateOfBirth: string): string {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    const months = Math.max(
      0,
      (now.getFullYear() - dob.getFullYear()) * 12 +
        (now.getMonth() - dob.getMonth()),
    );

    if (months < 24) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }

    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'}`;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private buildPhoneExactVariants(identifier: string): string[] {
    const raw = (identifier || '').trim();

    // Keep quick search strict: do not treat free text as a phone number.
    if (!raw || !/^[\d+\s()-]+$/.test(raw)) {
      return [];
    }

    const compact = raw.replace(/\s+/g, '').replace(/[()\-]/g, '');
    if (compact.length > 20) {
      return [];
    }

    if (!compact) {
      return [];
    }

    const variants = new Set<string>();
    variants.add(compact);

    if (compact.startsWith('0') && compact.length > 1) {
      const withoutZero = compact.slice(1);
      variants.add(`233${withoutZero}`);
      variants.add(`+233${withoutZero}`);
    } else if (compact.startsWith('233') && compact.length > 3) {
      const withoutCode = compact.slice(3);
      variants.add(`0${withoutCode}`);
      variants.add(`+233${withoutCode}`);
    } else if (compact.startsWith('+233') && compact.length > 4) {
      const withoutCode = compact.slice(4);
      variants.add(`0${withoutCode}`);
      variants.add(`233${withoutCode}`);
    }

    return Array.from(variants);
  }

  private escapeIlikePattern(value: string): string {
    return value.replace(/([\\%_])/g, '\\$1');
  }

  private normalizeWhitespace(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeNameForMatch(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private namesLikelySame(left: string, right: string): boolean {
    const normalizedLeft = this.normalizeNameForMatch(left);
    const normalizedRight = this.normalizeNameForMatch(right);

    if (!normalizedLeft || !normalizedRight) {
      return false;
    }

    return (
      normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft)
    );
  }

  private normalizePhone(value: string): string {
    return value.replace(/\s+/g, '').replace(/[()\-]/g, '');
  }

  private normalizeDateInput(value: string): string {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Child date of birth is invalid.');
    }
    return parsed.toISOString().slice(0, 10);
  }

  private normalizeGender(value?: string): 'male' | 'female' | 'intersex' | 'undisclosed' {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'male' || normalized === 'female' || normalized === 'intersex') {
      return normalized;
    }
    return 'undisclosed';
  }

  private extractOfflineRegistrationPayload(payload: any): ChwOfflineRegistrationPayload {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Registration payload is required.');
    }

    const motherName =
      typeof payload.motherName === 'string'
        ? this.normalizeWhitespace(payload.motherName)
        : '';
    const motherPhone =
      typeof payload.motherPhone === 'string'
        ? this.normalizePhone(payload.motherPhone)
        : '';
    const childName =
      typeof payload.childName === 'string'
        ? this.normalizeWhitespace(payload.childName)
        : '';
    const childDobRaw =
      typeof payload.childDob === 'string' ? payload.childDob : '';
    const childDob = this.normalizeDateInput(childDobRaw || '');

    if (!motherName) {
      throw new BadRequestException('Mother name is required.');
    }
    if (!motherPhone) {
      throw new BadRequestException('Mother phone is required.');
    }
    if (!childName) {
      throw new BadRequestException('Child name is required.');
    }

    return {
      guardianId:
        typeof payload.guardianId === 'string' && this.isUuid(payload.guardianId)
          ? payload.guardianId
          : undefined,
      motherName,
      motherPhone,
      childName,
      childDob,
      childGender:
        typeof payload.childGender === 'string' ? payload.childGender : undefined,
    };
  }

  private async getChwRegistrationContext(
    chwUserId: string,
  ): Promise<ChwRegistrationContext> {
    const [userResult, catchmentResult] = await Promise.all([
      this.db.supabase
        .from('users')
        .select('id, branch_id')
        .eq('id', chwUserId)
        .maybeSingle(),
      this.db.supabase
        .from('catchment_areas')
        .select('id, branch_id, community')
        .eq('assigned_chw_id', chwUserId)
        .limit(1),
    ]);

    if (userResult.error || !userResult.data) {
      throw new BadRequestException(
        userResult.error?.message || 'Unable to resolve CHW profile.',
      );
    }

    if (catchmentResult.error) {
      throw new BadRequestException(catchmentResult.error.message);
    }

    const catchment = (catchmentResult.data || [])[0];

    return {
      branchId: userResult.data.branch_id || catchment?.branch_id || null,
      catchmentAreaId: catchment?.id || null,
      community: catchment?.community || null,
    };
  }

  private async ensureGuardianForOfflineRegistration(
    payload: ChwOfflineRegistrationPayload,
    chwUserId: string,
    context: ChwRegistrationContext,
  ): Promise<string> {
    if (payload.guardianId) {
      const { data: guardianById, error: guardianByIdError } = await this.db.supabase
        .from('guardians')
        .select('id')
        .eq('id', payload.guardianId)
        .maybeSingle();

      if (guardianByIdError && guardianByIdError.code !== 'PGRST116') {
        throw new BadRequestException(guardianByIdError.message);
      }

      if (guardianById?.id) {
        return guardianById.id;
      }
    }

    const phoneVariants = this.buildPhoneExactVariants(payload.motherPhone);
    const phoneCandidates = Array.from(
      new Set(
        [payload.motherPhone, ...phoneVariants]
          .map((value) => this.normalizePhone(value))
          .filter(Boolean),
      ),
    );

    if (phoneCandidates.length > 0) {
      const { data: guardiansByPhone, error: guardianByPhoneError } = await this.db.supabase
        .from('guardians')
        .select('id, full_name')
        .in('phone_primary', phoneCandidates)
        .limit(10);

      if (guardianByPhoneError) {
        throw new BadRequestException(guardianByPhoneError.message);
      }

      const sameNameGuardian = (guardiansByPhone || []).find((guardian: any) =>
        this.namesLikelySame(guardian.full_name || '', payload.motherName),
      );

      if (sameNameGuardian?.id) {
        return sameNameGuardian.id;
      }

      if ((guardiansByPhone || []).length > 0) {
        throw new ConflictException(
          'This phone number is already linked to an existing mother profile. Please verify the number or select the existing mother suggestion.',
        );
      }
    }

    const { data: guardian, error: guardianCreateError } = await this.db.supabase
      .from('guardians')
      .insert({
        user_id: null,
        full_name: payload.motherName,
        phone_primary: payload.motherPhone,
        address_line1: 'Address to be completed at facility',
        city: context.community || 'Unknown',
        region: 'Unknown',
        country: 'Ghana',
        community: context.community || null,
        catchment_area_id: context.catchmentAreaId,
        preferred_contact: 'sms',
        notes:
          'Provisional guardian profile created from CHW minimal registration.',
        created_by_user_id: chwUserId,
      })
      .select('id')
      .single();

    if (guardianCreateError || !guardian) {
      if (guardianCreateError?.code === '23505') {
        const { data: fallbackGuardians, error: fallbackError } = await this.db.supabase
          .from('guardians')
          .select('id, full_name')
          .in('phone_primary', phoneCandidates)
          .limit(10);

        if (fallbackError) {
          throw new BadRequestException(fallbackError.message);
        }

        const sameNameFallback = (fallbackGuardians || []).find((entry: any) =>
          this.namesLikelySame(entry.full_name || '', payload.motherName),
        );

        if (sameNameFallback?.id) {
          return sameNameFallback.id;
        }
        throw new ConflictException(
          'This phone number is already linked to an existing mother profile. Please verify the number or select the existing mother suggestion.',
        );
      }

      throw new BadRequestException(
        guardianCreateError?.message ||
          'Failed to create provisional guardian profile.',
      );
    }

    return guardian.id;
  }

  private async findExistingChildForGuardian(
    guardianId: string,
    payload: ChwOfflineRegistrationPayload,
  ): Promise<string | null> {
    const { data, error } = await this.db.supabase
      .from('child_guardian')
      .select('child_id, children!inner(id, full_name, date_of_birth, is_active)')
      .eq('guardian_id', guardianId);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const targetName = payload.childName.toLowerCase();
    const targetDob = payload.childDob;

    const match = (data || []).find((row: any) => {
      const child = Array.isArray(row.children) ? row.children[0] : row.children;
      if (!child?.id || child?.is_active === false) {
        return false;
      }

      const childName = String(child.full_name || '').trim().toLowerCase();
      const childDob = String(child.date_of_birth || '').slice(0, 10);
      return childName === targetName && childDob === targetDob;
    });

    const child = match
      ? Array.isArray(match.children)
        ? match.children[0]
        : match.children
      : null;

    return child?.id || null;
  }

  private async createChildForOfflineRegistration(
    guardianId: string,
    chwUserId: string,
    context: ChwRegistrationContext,
    payload: ChwOfflineRegistrationPayload,
  ): Promise<string> {
    const existingChildId = await this.findExistingChildForGuardian(
      guardianId,
      payload,
    );

    if (existingChildId) {
      return existingChildId;
    }

    const childGender = this.normalizeGender(payload.childGender);
    let insertedChildId: string | null = null;
    let lastInsertError: any = null;
    const scheduleVersionId = await this.db.getActiveScheduleVersionId();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cvccId = `CVCC-${dateStamp}-${randomSuffix}`;
      const qrPayload = this.qrTokenService.generateChildToken();

      const { data: child, error: childInsertError } = await this.db.supabase
        .from('children')
        .insert({
          cvcc_id: cvccId,
          qr_code_payload: qrPayload,
          full_name: payload.childName,
          date_of_birth: payload.childDob,
          gender: childGender,
          primary_facility_id: context.branchId,
          schedule_version_id: scheduleVersionId,
          catchment_area_id: context.catchmentAreaId,
          critical_notes:
            'Provisional child profile created from CHW minimal registration.',
          created_by_user_id: chwUserId,
          is_active: true,
        })
        .select('id')
        .single();

      if (!childInsertError && child?.id) {
        insertedChildId = child.id;
        lastInsertError = null;
        break;
      }

      lastInsertError = childInsertError;
      if (childInsertError?.code !== '23505') {
        break;
      }
    }

    if (!insertedChildId) {
      throw new BadRequestException(
        lastInsertError?.message || 'Failed to create child profile.',
      );
    }

    const { error: linkError } = await this.db.supabase
      .from('child_guardian')
      .insert({
        child_id: insertedChildId,
        guardian_id: guardianId,
        relationship: 'mother',
        is_primary: true,
      });

    if (linkError) {
      await this.db.supabase.from('children').delete().eq('id', insertedChildId);
      throw new BadRequestException(
        `Failed to link child to guardian: ${linkError.message}`,
      );
    }

    return insertedChildId;
  }

  private summarizeSyncError(error: unknown): string {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown sync error';

    return message.length > 400 ? message.slice(0, 400) : message;
  }

  private async materializeOfflineRegistration(
    queueId: string,
    chwUserId: string,
    rawPayload: any,
  ): Promise<string> {
    const payload = this.extractOfflineRegistrationPayload(rawPayload);
    const context = await this.getChwRegistrationContext(chwUserId);
    const guardianId = await this.ensureGuardianForOfflineRegistration(
      payload,
      chwUserId,
      context,
    );
    const childId = await this.createChildForOfflineRegistration(
      guardianId,
      chwUserId,
      context,
      payload,
    );

    const syncTimestamp = new Date().toISOString();

    const { error: queueUpdateError } = await this.db.supabase
      .from('sync_queue')
      .update({
        status: 'synced',
        entity_id: childId,
        synced_at: syncTimestamp,
        conflict_reason: null,
        retry_count: 0,
        updated_at: syncTimestamp,
      })
      .eq('id', queueId);

    if (queueUpdateError) {
      throw new BadRequestException(queueUpdateError.message);
    }

    return childId;
  }

  private async getAssignedChildren(chwUserId: string): Promise<AssignedChild[]> {
    this.logger.debug('[CHW getAssignedChildren] Fetching assigned catchments');
    
    const { data: catchments, error: catchmentError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, community')
      .eq('assigned_chw_id', chwUserId);

    if (catchmentError) {
      throw new BadRequestException(catchmentError.message);
    }

    this.logger.debug(`[CHW getAssignedChildren] Found ${(catchments || []).length} catchment areas`);

    const catchmentIds = (catchments || []).map((item: any) => item.id);
    const catchmentMap = new Map<string, string | undefined>(
      (catchments || []).map((item: any) => [item.id, item.community]),
    );

    if (catchmentIds.length === 0) {
      this.logger.debug('[CHW getAssignedChildren] No catchments found');
      return [];
    }

    // Query children directly by their own catchment_area_id so that transferred
    // children (whose guardian catchment may differ) are still visible.
    const { data: children, error: childrenError } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        qr_code_payload,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        catchment_area_id,
        child_guardian (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary,
            community,
            city
          )
        )
      `)
      .in('catchment_area_id', catchmentIds)
      .eq('is_active', true);

    if (childrenError) {
      throw new BadRequestException(childrenError.message);
    }

    this.logger.debug(`[CHW getAssignedChildren] Found ${(children || []).length} children`);

    const result: AssignedChild[] = (children || []).map((child: any) => {
      const links: any[] = Array.isArray(child.child_guardian) ? child.child_guardian : [];
      const primaryLink = links.find((l: any) => l.is_primary && l.guardians) || links[0];
      const guardian = primaryLink?.guardians || null;

      return {
        id: child.id,
        cvccId: child.cvcc_id,
        qrPayload: child.qr_code_payload || undefined,
        fullName: child.full_name,
        dateOfBirth: child.date_of_birth,
        gender: child.gender,
        primaryFacilityId: child.primary_facility_id || undefined,
        guardianName: guardian?.full_name || undefined,
        guardianPhone: guardian?.phone_primary || undefined,
        village:
          guardian?.community ||
          catchmentMap.get(child.catchment_area_id) ||
          guardian?.city ||
          undefined,
        catchmentAreaId: child.catchment_area_id,
      };
    });

    this.logger.debug(`[CHW getAssignedChildren] Returning ${result.length} children`);

    return result;
  }

  async getDashboardSummary(chwUserId: string) {
    const assignedChildren = await this.getAssignedChildren(chwUserId);

    const visitCandidates = assignedChildren.slice(0, 5);
    const visits = await Promise.all(
      visitCandidates.map(async (child, index) => {
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.dateOfBirth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccine = this.readVaccineName(next?.vaccine);

        return {
          id: `VIS-${index + 1}`,
          childId: child.id,
          childName: child.fullName,
          vaccineDue: nextVaccine || 'Review chart',
          householdLocation: child.village || 'Assigned catchment',
          distanceKm: Number((1 + index * 0.8).toFixed(1)),
        };
      }),
    );

    const { count: pendingQueueCount } = await this.db.supabase
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', chwUserId)
      .in('status', ['pending', 'failed']);

    return {
      totalAssignedChildren: assignedChildren.length,
      pendingQueueCount: pendingQueueCount || 0,
      visits,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getNotifications(
    chwUserId: string,
    limit = 10,
    unreadOnly = true,
  ): Promise<
    Array<{
      id: string;
      templateId: string;
      subject: string | null;
      message: string;
      status: string;
      createdAt: string;
      metadata: Record<string, unknown>;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(limit, 30));

    let query = this.db.supabase
      .from('notifications')
      .select('id, template_id, subject, message, status, created_at, metadata')
      .eq('recipient_type', 'staff')
      .eq('recipient_id', chwUserId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (unreadOnly) {
      query = query.in('status', ['pending', 'sent']);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((notification: any) => ({
      id: notification.id,
      templateId: notification.template_id,
      subject: notification.subject || null,
      message: notification.message,
      status: notification.status,
      createdAt: notification.created_at,
      metadata:
        notification.metadata && typeof notification.metadata === 'object'
          ? notification.metadata
          : {},
    }));
  }

  async markNotificationRead(chwUserId: string, notificationId: string) {
    const { data, error } = await this.db.supabase
      .from('notifications')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('recipient_type', 'staff')
      .eq('recipient_id', chwUserId)
      .in('status', ['pending', 'sent'])
      .select('id')
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      success: true,
      marked: Boolean(data),
    };
  }

  async searchChildren(query: string, chwUserId: string) {
    const rawQuery = (query || '').trim();
    const normalized = rawQuery.toLowerCase();
    if (!normalized) {
      return [];
    }

    const assignedChildren = await this.getAssignedChildren(chwUserId);

    // Debug logging disabled for security (no PII logging)
    // const log = { user: chwUserId, query, count: assignedChildren.length };

    const matches = assignedChildren.filter((child) => {
      if (this.qrTokenService.isKnownToken(rawQuery)) {
        return child.qrPayload === rawQuery;
      }

      return (
        child.fullName.toLowerCase().includes(normalized) ||
        child.cvccId.toLowerCase().includes(normalized) ||
        (child.guardianName || '').toLowerCase().includes(normalized) ||
        (child.guardianPhone || '').replace(/\s+/g, '').includes(normalized.replace(/\s+/g, ''))
      );
    });

    return Promise.all(
      matches.slice(0, 20).map(async (child) => {
        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.dateOfBirth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccineName = this.readVaccineName(next?.vaccine);

        return {
          id: child.id,
          childId: child.cvccId,
          childName: child.fullName,
          motherName: child.guardianName || 'Unknown',
          motherPhone: child.guardianPhone || 'N/A',
          nextVaccine: nextVaccineName || 'Review chart',
          village: child.village || 'Assigned catchment',
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
        };
      }),
    );
  }

  /**
   * Search all children without catchment restriction
   * Used when CHW is online and can help children from any area
   */
  async searchAllChildren(query: string, chwUserId: string) {
    const rawQuery = (query || '').trim();
    const normalized = rawQuery.toLowerCase();
    if (!normalized) {
      return [];
    }

    this.logger.debug('[CHW Search All] Starting search');

    let childrenByName: any[] | null = null;
    let nameError: any = null;

    // Strategy 1a: Exact token lookup for opaque QR scans
    if (this.qrTokenService.isKnownToken(rawQuery)) {
      const tokenQuery = await this.db.supabase
        .from('children')
        .select(`
          id,
          cvcc_id,
          full_name,
          date_of_birth,
          gender,
          primary_facility_id,
          child_guardian!inner (
            is_primary,
            guardians (
              id,
              full_name,
              phone_primary,
              community,
              city,
              catchment_area_id
            )
          )
        `)
        .eq('qr_code_payload', rawQuery)
        .limit(20);

      childrenByName = tokenQuery.data || [];
      nameError = tokenQuery.error;
    } else {
      // Strategy 1b: Search children by name or CVCC ID
      const fuzzyQuery = await this.db.supabase
        .from('children')
        .select(`
          id,
          cvcc_id,
          full_name,
          date_of_birth,
          gender,
          primary_facility_id,
          child_guardian!inner (
            is_primary,
            guardians (
              id,
              full_name,
              phone_primary,
              community,
              city,
              catchment_area_id
            )
          )
        `)
        .or(`full_name.ilike.%${normalized}%,cvcc_id.ilike.%${normalized}%`)
        .limit(20);

      childrenByName = fuzzyQuery.data || [];
      nameError = fuzzyQuery.error;
    }

    if (nameError) {
      throw new BadRequestException(nameError.message);
    }

    // Strategy 2: Search guardians by phone, then get their children
    // Handle Ghana phone formats: 0XX, 233XX, +233XX
    let phoneNormalized = normalized.replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // Build phone search variants for Ghana numbers
    const phoneVariants: string[] = [];

    if (phoneNormalized.length >= 6) {
      // Add the original normalized phone
      phoneVariants.push(phoneNormalized);

      // If starts with 0, also try 233 and +233 variants
      if (phoneNormalized.startsWith('0')) {
        const withoutZero = phoneNormalized.substring(1);
        phoneVariants.push(`233${withoutZero}`);
        phoneVariants.push(`+233${withoutZero}`);
      }
      // If starts with 233, also try 0 and +233 variants
      else if (phoneNormalized.startsWith('233')) {
        const withoutCode = phoneNormalized.substring(3);
        phoneVariants.push(`0${withoutCode}`);
        phoneVariants.push(`+233${withoutCode}`);
      }
      // If starts with +233, also try 0 and 233 variants
      else if (phoneNormalized.startsWith('+233')) {
        const withoutCode = phoneNormalized.substring(4);
        phoneVariants.push(`0${withoutCode}`);
        phoneVariants.push(`233${withoutCode}`);
      }
    }

    this.logger.debug(`[CHW Search All] Searching by phone variants: ${phoneVariants.join(', ')}`);

    // Search with all phone variants
    let guardiansByPhone: any[] = [];

    if (phoneVariants.length > 0) {
      // Build OR conditions for all phone variants
      const phoneConditions = phoneVariants.map(p => `phone_primary.ilike.%${p}%`).join(',');

      const { data, error: phoneError } = await this.db.supabase
        .from('guardians')
        .select(`
          id,
          full_name,
          phone_primary,
          community,
          city,
          catchment_area_id,
          child_guardian!inner (
            is_primary,
            children (
              id,
              cvcc_id,
              full_name,
              date_of_birth,
              gender,
              primary_facility_id
            )
          )
        `)
        .or(phoneConditions)
        .limit(20);

      if (phoneError) {
        console.error('[CHW Search All] Phone search error:', phoneError);
      } else {
        guardiansByPhone = data || [];
        this.logger.debug(`[CHW Search All] Found ${guardiansByPhone.length} guardians by phone`);
      }
    }

    // Combine results and deduplicate by child ID
    const childrenMap = new Map();

    // Add children from name search
    (childrenByName || []).forEach((child: any) => {
      if (!childrenMap.has(child.id)) {
        childrenMap.set(child.id, child);
      }
    });

    // Add children from phone search
    (guardiansByPhone || []).forEach((guardian: any) => {
      const guardianLinks = Array.isArray(guardian.child_guardian)
        ? guardian.child_guardian
        : [];
      guardianLinks.forEach((link: any) => {
        const child = Array.isArray(link.children) ? link.children[0] : link.children;
        if (child && !childrenMap.has(child.id)) {
          // Reconstruct child object with guardian data
          childrenMap.set(child.id, {
            ...child,
            child_guardian: [{
              is_primary: link.is_primary,
              guardians: {
                id: guardian.id,
                full_name: guardian.full_name,
                phone_primary: guardian.phone_primary,
                community: guardian.community,
                city: guardian.city,
                catchment_area_id: guardian.catchment_area_id,
              }
            }]
          });
        }
      });
    });

    const childrenWithGuardians = Array.from(childrenMap.values()).slice(0, 20);

    this.logger.debug(`[CHW Search All] Search returned ${childrenWithGuardians.length} results`);

    // Pre-fetch child catchment info for all children at once
    const childIds = Array.from(childrenMap.keys());
    const { data: childrenWithCatchment } = await this.db.supabase
      .from('children')
      .select('id, catchment_area_id')
      .in('id', childIds);

    const childCatchmentMap = new Map(
      (childrenWithCatchment || []).map((c: any) => [c.id, c.catchment_area_id])
    );

    // Pre-fetch all catchment area names
    const catchmentIds = [...new Set(
      (childrenWithCatchment || [])
        .map((c: any) => c.catchment_area_id)
        .filter(Boolean)
    )];

    let catchmentNameMap = new Map<string, { name: string; branchId: string }>();
    if (catchmentIds.length > 0) {
      const { data: catchments } = await this.db.supabase
        .from('catchment_areas')
        .select('id, name, branch_id')
        .in('id', catchmentIds);
      catchmentNameMap = new Map(
        (catchments || []).map((c: any) => [c.id, { name: c.name, branchId: c.branch_id }])
      );
    }

    const results = await Promise.all(
      (childrenWithGuardians || []).map(async (child: any) => {
        // Find primary guardian
        const guardianLinks = Array.isArray(child.child_guardian)
          ? child.child_guardian
          : [];
        const primaryLink = guardianLinks.find((link: any) => link.is_primary);
        const guardianData = Array.isArray(primaryLink?.guardians)
          ? primaryLink.guardians[0]
          : primaryLink?.guardians;

        const upcoming = await this.db.getUpcomingVaccinations(
          child.id,
          child.date_of_birth,
        );
        const next: any = (upcoming || [])[0];
        const nextVaccineName = this.readVaccineName(next?.vaccine);

        // Get child's direct catchment_area_id (for pull transfer)
        const childCatchmentId = childCatchmentMap.get(child.id);
        const catchmentInfo = childCatchmentId ? catchmentNameMap.get(childCatchmentId) : null;

        return {
          id: child.id,
          childId: child.cvcc_id,
          childName: child.full_name,
          motherName: guardianData?.full_name || 'Unknown',
          motherPhone: guardianData?.phone_primary || 'N/A',
          nextVaccine: nextVaccineName || 'Review chart',
          village: guardianData?.community || guardianData?.city || 'Unknown',
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          // Include child's direct catchment info for pull transfer decision
          catchmentAreaId: childCatchmentId || null,
          currentZoneName: catchmentInfo?.name || null,
          currentBranchId: catchmentInfo?.branchId || null,
        };
      }),
    );

    return results;
  }

  /**
   * Search mothers/guardians directly by name or phone
   * Used by CHW minimal registration autocomplete
   */
  async searchMothers(query: string) {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const compact = normalized.replace(/\s+/g, '');

    const { data, error } = await this.db.supabase
      .from('guardians')
      .select('id, full_name, phone_primary')
      .or(`full_name.ilike.%${normalized}%,phone_primary.ilike.%${compact}%`)
      .limit(10);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((guardian: any) => ({
      id: guardian.id,
      name: guardian.full_name,
      phone: guardian.phone_primary || '',
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER IN SEARCH - Dual search methods for child lookup
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Quick Search by Identifier (child UUID/CVCC ID or mother phone)
   * Primary, fast search method for transfer-in lookup
   *
   * Searches for:
   * 1. Children by UUID (exact match against children.id)
   * 2. Children by CVCC ID (exact match against children.cvcc_id)
   * 3. Guardians by phone number (exact match), then their children
   */
  async searchByIdentifier(identifier: string, chwUserId: string) {
    const trimmedIdentifier = (identifier || '').trim();
    if (!trimmedIdentifier) {
      return [];
    }

    if (trimmedIdentifier.length > 64) {
      throw new BadRequestException('Identifier is too long');
    }

    this.logger.debug('[Quick Search] Running exact identifier lookup');

    const dedupedChildren = new Map<string, any>();
    const compactIdentifier = trimmedIdentifier.replace(/\s+/g, '');
    const cvccCandidates = Array.from(
      new Set([
        trimmedIdentifier,
        compactIdentifier,
        compactIdentifier.toUpperCase(),
      ].filter(Boolean)),
    );

    // Strategy 1: Exact child UUID lookup
    if (this.isUuid(trimmedIdentifier)) {
      const { data: childByUuid, error: childError } = await this.db.supabase
        .from('children')
        .select(`
          id,
          cvcc_id,
          full_name,
          date_of_birth,
          gender,
          catchment_area_id,
          child_guardian!inner (
            is_primary,
            guardians (
              id,
              full_name,
              phone_primary,
              community,
              city
            )
          )
        `)
        .eq('id', trimmedIdentifier)
        .limit(1);

      if (childError) {
        throw new BadRequestException(`Search failed: ${childError.message}`);
      }

      (childByUuid || []).forEach((child: any) => {
        if (child?.id) {
          dedupedChildren.set(child.id, child);
        }
      });
    }

    // Strategy 2: Exact child CVCC ID lookup
    if (cvccCandidates.length > 0) {
      const { data: childByCvcc, error: cvccError } = await this.db.supabase
        .from('children')
        .select(`
          id,
          cvcc_id,
          full_name,
          date_of_birth,
          gender,
          catchment_area_id,
          child_guardian!inner (
            is_primary,
            guardians (
              id,
              full_name,
              phone_primary,
              community,
              city
            )
          )
        `)
        .in('cvcc_id', cvccCandidates)
        .limit(3);

      if (cvccError) {
        throw new BadRequestException(`Search failed: ${cvccError.message}`);
      }

      (childByCvcc || []).forEach((child: any) => {
        if (child?.id) {
          dedupedChildren.set(child.id, child);
        }
      });
    }

    // Strategy 3: Exact mother phone lookup (with exact Ghana variants)
    const phoneVariants = this.buildPhoneExactVariants(trimmedIdentifier);
    if (phoneVariants.length > 0) {
      const { data: guardiansByPhone, error: phoneError } = await this.db.supabase
        .from('guardians')
        .select(`
          id,
          full_name,
          phone_primary,
          community,
          city,
          child_guardian!inner (
            is_primary,
            children (
              id,
              cvcc_id,
              full_name,
              date_of_birth,
              gender,
              catchment_area_id
            )
          )
        `)
        .in('phone_primary', phoneVariants)
        .limit(10);

      if (phoneError) {
        throw new BadRequestException(`Search failed: ${phoneError.message}`);
      }

      (guardiansByPhone || []).forEach((guardian: any) => {
        const guardianLinks = Array.isArray(guardian.child_guardian)
          ? guardian.child_guardian
          : [];

        guardianLinks.forEach((link: any) => {
          const child = Array.isArray(link.children) ? link.children[0] : link.children;
          if (!child?.id) {
            return;
          }

          dedupedChildren.set(child.id, {
            ...child,
            child_guardian: [
              {
                is_primary: link.is_primary,
                guardians: {
                  id: guardian.id,
                  full_name: guardian.full_name,
                  phone_primary: guardian.phone_primary,
                  community: guardian.community,
                  city: guardian.city,
                },
              },
            ],
          });
        });
      });
    }

    return this.formatSearchResults(Array.from(dedupedChildren.values()), chwUserId);
  }

  /**
   * Advanced Search by Child Name, Mother Name, and Date of Birth
   * Fallback search method when quick search fails
   *
   * All three parameters are required (validated by DTO)
   * Uses case-insensitive ILIKE search, limited to 10 results
   */
  async advancedSearch(
    childName: string,
    motherName: string,
    dob: string,
    chwUserId: string,
  ) {
    const childNormalized = (childName || '').trim();
    const motherNormalized = (motherName || '').trim().toLowerCase();
    const normalizedDob = (dob || '').trim();

    if (!childNormalized || !motherNormalized || !normalizedDob) {
      throw new BadRequestException(
        'childName, motherName, and dob are required for advanced search',
      );
    }

    if (childNormalized.length > 80 || motherNormalized.length > 120) {
      throw new BadRequestException('Search fields exceed allowed length');
    }

    const safeChildPattern = `%${this.escapeIlikePattern(childNormalized)}%`;

    this.logger.debug(
      `[Advanced Search] Searching for child: ${childNormalized}, mother: ${motherNormalized}, DOB: ${normalizedDob}`,
    );

    // Search children by name and DOB, then filter by mother name
    const { data: children, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        catchment_area_id,
        child_guardian!inner (
          is_primary,
          guardians!inner (
            id,
            full_name,
            phone_primary,
            community,
            city
          )
        )
      `)
      .ilike('full_name', safeChildPattern)
      .eq('date_of_birth', normalizedDob)
      .limit(50);

    if (error) {
      this.logger.error('[Advanced Search] Query error:', error);
      throw new BadRequestException(`Search failed: ${error.message}`);
    }

    if (!children || children.length === 0) {
      this.logger.debug('[Advanced Search] No children found');
      return [];
    }

    // Filter by mother name
    const filtered = children.filter((child: any) => {
      const guardianLinks = Array.isArray(child.child_guardian) ? child.child_guardian : [];
      return guardianLinks.some((link: any) => {
        const guardian = Array.isArray(link.guardians) ? link.guardians[0] : link.guardians;
        return (
          guardian?.full_name &&
          guardian.full_name.toLowerCase().includes(motherNormalized)
        );
      });
    });

    this.logger.debug(`[Advanced Search] Found ${filtered.length} matching children`);

    return this.formatSearchResults(filtered.slice(0, 10), chwUserId);
  }

  /**
   * Format search results with catchment information
   * Determines if child requires pull transfer
   */
  private async formatSearchResults(children: any[], chwUserId: string) {
    if (children.length === 0) return [];

    // Get CHW's catchment areas
    const { data: chwCatchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id')
      .eq('assigned_chw_id', chwUserId);

    const chwCatchmentIds = new Set((chwCatchments || []).map((c: any) => c.id));

    // Get child catchment info
    const childIds = children.map((c) => c.id);
    const { data: childrenWithCatchment } = await this.db.supabase
      .from('children')
      .select('id, catchment_area_id')
      .in('id', childIds);

    const childCatchmentMap = new Map(
      (childrenWithCatchment || []).map((c: any) => [c.id, c.catchment_area_id]),
    );

    // Get catchment names
    const catchmentIds = [
      ...new Set(
        (childrenWithCatchment || [])
          .map((c: any) => c.catchment_area_id)
          .filter(Boolean),
      ),
    ];

    let catchmentNameMap = new Map<string, { name: string; branchId: string }>();
    if (catchmentIds.length > 0) {
      const { data: catchments } = await this.db.supabase
        .from('catchment_areas')
        .select('id, name, branch_id')
        .in('id', catchmentIds);
      catchmentNameMap = new Map(
        (catchments || []).map((c: any) => [c.id, { name: c.name, branchId: c.branch_id }]),
      );
    }

    // Format results
    return Promise.all(
      children.map(async (child: any) => {
        const guardianLinks = Array.isArray(child.child_guardian) ? child.child_guardian : [];
        const primaryLink = guardianLinks.find((link: any) => link.is_primary);
        const guardianData = Array.isArray(primaryLink?.guardians)
          ? primaryLink.guardians[0]
          : primaryLink?.guardians;

        const upcoming = await this.db.getUpcomingVaccinations(child.id, child.date_of_birth);
        const next: any = (upcoming || [])[0];
        const nextVaccineName = this.readVaccineName(next?.vaccine);

        const childCatchmentId = childCatchmentMap.get(child.id);
        const catchmentInfo = childCatchmentId ? catchmentNameMap.get(childCatchmentId) : null;

        // Determine if pull is required (child is in another CHW's catchment)
        const requiresPull = !!childCatchmentId && !chwCatchmentIds.has(childCatchmentId);

        return {
          id: child.id,
          childId: child.cvcc_id || child.id,
          childName: child.full_name,
          dateOfBirth: child.date_of_birth,
          gender: child.gender,
          motherName: guardianData?.full_name || 'Unknown',
          motherPhone: guardianData?.phone_primary || 'N/A',
          village: guardianData?.community || guardianData?.city || 'Unknown',
          nextVaccine: nextVaccineName || 'Review chart',
          catchmentAreaId: childCatchmentId || null,
          currentZoneName: catchmentInfo?.name || null,
          currentBranchId: catchmentInfo?.branchId || null,
          requiresPull,
        };
      }),
    );
  }

  async getChildChart(childId: string, chwUserId: string) {
    const assignedChildren = await this.getAssignedChildren(chwUserId);
    const child = assignedChildren.find((entry) => entry.id === childId);

    if (!child) {
      throw new NotFoundException('Child not found in your assigned catchment');
    }

    const history = await this.db.getVaccinationHistory(child.id);
    const upcoming = await this.db.getUpcomingVaccinations(
      child.id,
      child.dateOfBirth,
    );

    return {
      id: child.id,
      name: child.fullName,
      age: this.toAgeLabel(child.dateOfBirth),
      dateOfBirth: child.dateOfBirth,
      motherName: child.guardianName || 'Unknown',
      motherPhone: child.guardianPhone || 'N/A',
      village: child.village || 'Assigned catchment',
      outstandingVaccines: (upcoming || []).map((item: any) => ({
        id: `${this.readVaccineId(item.vaccine) || item.dose_number}-${item.dose_number}`,
        name: this.readVaccineName(item.vaccine) || 'Scheduled vaccine',
        status: item.isOverdue ? 'overdue' : 'due',
        scheduledDate: this.toReadableDate(item.dueDate),
      })),
      history: (history || []).map((event: any) => ({
        id: event.id,
        name: this.readVaccineName(event.vaccine) || 'Vaccine',
        status: 'completed',
        scheduledDate: this.toReadableDate(event.administered_date),
        administeredDate: this.toReadableDate(event.administered_date),
      })),
    };
  }

  /**
   * Get child chart without catchment restriction
   * Used when CHW is online and can help children from any area
   */
  async getChildChartAll(childId: string, chwUserId: string) {
    this.logger.debug('[CHW Chart All] Fetching child chart');

    // Get child data without catchment filter
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        child_guardian!inner (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary,
            community,
            city,
            catchment_area_id
          )
        )
      `)
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException('Child not found');
    }

    // Find primary guardian
    const guardianLinks = Array.isArray(child.child_guardian)
      ? child.child_guardian
      : [];
    const primaryLink = guardianLinks.find((link: any) => link.is_primary);
    const guardianData = Array.isArray(primaryLink?.guardians)
      ? primaryLink.guardians[0]
      : primaryLink?.guardians;

    const history = await this.db.getVaccinationHistory(child.id);
    const upcoming = await this.db.getUpcomingVaccinations(
      child.id,
      child.date_of_birth,
    );

    this.logger.debug('[CHW Chart All] Child chart retrieved');

    return {
      id: child.id,
      name: child.full_name,
      age: this.toAgeLabel(child.date_of_birth),
      dateOfBirth: child.date_of_birth,
      motherName: guardianData?.full_name || 'Unknown',
      motherPhone: guardianData?.phone_primary || 'N/A',
      village: guardianData?.community || guardianData?.city || 'Unknown area',
      outstandingVaccines: (upcoming || []).map((item: any) => ({
        id: `${this.readVaccineId(item.vaccine) || item.dose_number}-${item.dose_number}`,
        name: this.readVaccineName(item.vaccine) || 'Scheduled vaccine',
        status: item.isOverdue ? 'overdue' : 'due',
        scheduledDate: this.toReadableDate(item.dueDate),
      })),
      history: (history || []).map((event: any) => ({
        id: event.id,
        name: this.readVaccineName(event.vaccine) || 'Vaccine',
        status: 'completed',
        scheduledDate: this.toReadableDate(event.administered_date),
        administeredDate: this.toReadableDate(event.administered_date),
      })),
    };
  }

  async queueOfflineRegistration(chwUserId: string, payload: any) {
    const { data, error } = await this.db.supabase
      .from('sync_queue')
      .insert({
        user_id: chwUserId,
        entity_type: 'child',
        operation: 'create',
        payload,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single();

    if (error || !data) {
      throw new BadRequestException(error?.message || 'Failed to queue registration');
    }

    let finalStatus = data.status;
    let childId: string | null = null;
    let errorMessage: string | undefined;

    try {
      childId = await this.materializeOfflineRegistration(data.id, chwUserId, payload);
      finalStatus = 'synced';
    } catch (materializationError) {
      const conflictReason = this.summarizeSyncError(materializationError);
      const updateTimestamp = new Date().toISOString();

      await this.db.supabase
        .from('sync_queue')
        .update({
          status: 'failed',
          conflict_reason: conflictReason,
          retry_count: 1,
          updated_at: updateTimestamp,
        })
        .eq('id', data.id);

      this.logger.error(
        `[CHW queueOfflineRegistration] Materialization failed for queue ${data.id}: ${conflictReason}`,
      );
      finalStatus = 'failed';
      errorMessage = conflictReason;
    }

    return {
      queued: true,
      queueId: data.id,
      status: finalStatus,
      createdAt: data.created_at,
      childId,
      errorMessage,
    };
  }

  async getChildrenByAssignedCatchmentArea(
    catchmentAreaId: string,
    chwUserId: string,
  ) {
    if (!catchmentAreaId) {
      throw new BadRequestException('catchmentAreaId is required');
    }

    const { data: catchmentArea, error: catchmentError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, code, community, branch_id, assigned_chw_id')
      .eq('id', catchmentAreaId)
      .single();

    if (catchmentError || !catchmentArea) {
      throw new NotFoundException('Catchment area not found');
    }

    if (!catchmentArea.assigned_chw_id || catchmentArea.assigned_chw_id !== chwUserId) {
      throw new ForbiddenException(
        'You are not assigned to this catchment area',
      );
    }

    const { data: guardians, error: guardiansError } = await this.db.supabase
      .from('guardians')
      .select(`
        id,
        full_name,
        phone_primary,
        catchment_area_id,
        child_guardian (
          is_primary,
          relationship,
          children (
            id,
            cvcc_id,
            full_name,
            date_of_birth,
            gender,
            primary_facility_id,
            updated_at
          )
        )
      `)
      .eq('catchment_area_id', catchmentAreaId);

    if (guardiansError) {
      throw new BadRequestException(guardiansError.message);
    }

    const dedupedChildren = new Map<string, ChwOfflineChild>();

    (guardians || []).forEach((guardian: any) => {
      const childLinks = Array.isArray(guardian.child_guardian)
        ? guardian.child_guardian
        : [];

      childLinks.forEach((link: any) => {
        const children = this.toChildArray(link?.children);
        children.forEach((child: any) => {
          if (!child?.id) return;

          if (!dedupedChildren.has(child.id) || link.is_primary) {
            dedupedChildren.set(child.id, {
              id: child.id,
              cvccId: child.cvcc_id,
              fullName: child.full_name,
              dateOfBirth: child.date_of_birth,
              gender: child.gender,
              primaryFacilityId: child.primary_facility_id || undefined,
              catchmentAreaId,
              guardianName: guardian.full_name || undefined,
              guardianPhone: guardian.phone_primary || undefined,
              updatedAt: child.updated_at || new Date().toISOString(),
            });
          }
        });
      });
    });

    return {
      catchmentArea: {
        id: catchmentArea.id,
        name: catchmentArea.name,
        code: catchmentArea.code,
        community: catchmentArea.community,
        branchId: catchmentArea.branch_id,
      },
      totalChildren: dedupedChildren.size,
      children: Array.from(dedupedChildren.values()),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Sync offline CHW vaccinations to the database
   * Accepts batch vaccinations with GPS coordinates
   */
  async syncOfflineVaccinations(
    dto: SyncCHWVaccinationsDto,
    chwUserId: string,
  ): Promise<SyncResultDto> {
    const result: SyncResultDto = {
      synced: 0,
      failed: 0,
      errors: [],
    };

    // Process each vaccination
    for (const vaccination of dto.vaccinations) {
      try {
        // Lookup vaccine by name to get vaccine_id
        const { data: vaccine, error: vaccineError } = await this.db.supabase
          .from('vaccines')
          .select('id, name')
          .eq('name', vaccination.vaccineName)
          .single();

        if (vaccineError || !vaccine) {
          result.failed++;
          result.errors.push({
            vaccination,
            reason: `Vaccine not found: ${vaccination.vaccineName}`,
          });
          continue;
        }

        // Build notes with GPS coordinates if available
        let notes = vaccination.notes || '';
        if (
          typeof vaccination.latitude === 'number' &&
          typeof vaccination.longitude === 'number'
        ) {
          const gpsData = JSON.stringify({
            latitude: vaccination.latitude,
            longitude: vaccination.longitude,
            recordedAt: vaccination.recordedDate,
          });
          notes = notes ? `${notes}\n\nGPS: ${gpsData}` : `GPS: ${gpsData}`;
        }

        // Insert vaccination event
        const { error: insertError } = await this.db.supabase
          .from('vaccination_events')
          .insert({
            child_id: vaccination.childId,
            vaccine_id: vaccine.id,
            dose_number: 1, // Default to dose 1 for CHW field visits
            administered_date: vaccination.recordedDate,
            administered_by_user_id: chwUserId,
            batch_number: null, // CHW field visits don't have batch numbers
            lot_number: null,
            expiry_date: null,
            vaccination_site: null, // Could be inferred from GPS but keeping simple
            status: 'completed',
            notes: notes || null,
          });

        if (insertError) {
          result.failed++;
          result.errors.push({
            vaccination,
            reason: `Database error: ${insertError.message}`,
          });
          continue;
        }

        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          vaccination,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Transfer Out: Remove child from CHW's catchment area
   * Sets child's catchment_area_id to NULL (soft disconnect)
   * Used when a mother/child leaves the area
   */
  async transferOut(childId: string, chwUserId: string, reason?: string) {
    this.logger.debug('[CHW TransferOut] Processing transfer out');

    // Get CHW's catchment area(s)
    const { data: chwCatchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name')
      .eq('assigned_chw_id', chwUserId);

    if (!chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const chwCatchmentIds = chwCatchments.map(c => c.id);

    // Get child's current info
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Verify child is in CHW's catchment
    if (!child.catchment_area_id || !chwCatchmentIds.includes(child.catchment_area_id)) {
      throw new ForbiddenException(
        'Cannot transfer out: This child is not in your assigned catchment area'
      );
    }

    // Get catchment name for audit log
    const previousCatchment = chwCatchments.find(c => c.id === child.catchment_area_id);

    // Set catchment_area_id to NULL
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({ catchment_area_id: null })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer out failed: ${updateError.message}`);
    }

    // Log the transfer in audit_logs
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_out',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        previousCatchment: previousCatchment?.name || 'Unknown',
        reason: reason || 'Family relocated',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: `${child.full_name} transferred out successfully`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: previousCatchment?.name,
      newCatchment: null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Transfer In: Add child to CHW's catchment area
   * Updates child's catchment_area_id to CHW's assigned catchment
   * Used when a new mother arrives in the area (found via global search)
   */
  async transferIn(childId: string, chwUserId: string, notes?: string) {
    this.logger.debug('[CHW TransferIn] Processing transfer in');

    // Get CHW's primary catchment area
    const { data: chwCatchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community')
      .eq('assigned_chw_id', chwUserId)
      .limit(1);

    if (!chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const chwCatchment = chwCatchments[0];

    // Get child's current info
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if child is already in this CHW's catchment
    if (child.catchment_area_id === chwCatchment.id) {
      return {
        success: true,
        message: `${child.full_name} is already in your catchment area`,
        childId: child.id,
        childName: child.full_name,
        previousCatchment: chwCatchment.name,
        newCatchment: chwCatchment.name,
        timestamp: new Date().toISOString(),
      };
    }

    // Store previous catchment for audit
    let previousCatchmentName = 'None (was transferred out)';
    if (child.catchment_area_id) {
      const { data: prevCatchment } = await this.db.supabase
        .from('catchment_areas')
        .select('name')
        .eq('id', child.catchment_area_id)
        .single();
      if (prevCatchment) {
        previousCatchmentName = prevCatchment.name;
      }
    }

    // Update child's catchment_area_id to CHW's catchment
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({ catchment_area_id: chwCatchment.id })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer in failed: ${updateError.message}`);
    }

    // Log the transfer in audit_logs
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_in',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        previousCatchment: previousCatchmentName,
        newCatchment: chwCatchment.name,
        catchmentCommunity: chwCatchment.community,
        notes: notes || 'Family relocated to this area',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      message: `${child.full_name} transferred in successfully. Now in your local register.`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: previousCatchmentName,
      newCatchment: chwCatchment.name,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Transfer Pull: Forcefully pull a child from another catchment area
   *
   * This is the "Pull Mechanism" - a CHW can pull a child's record from
   * another CHW's catchment area, even if the old CHW hasn't transferred them out.
   *
   * Creates dual audit logs:
   * 1. transfer_out for the OLD catchment (logs +1 Transfer Out for old branch)
   * 2. transfer_in for the NEW catchment (logs +1 Transfer In for new branch)
   */
  async transferPull(childId: string, chwUserId: string, notes?: string) {
    this.logger.debug('[CHW TransferPull] Processing forceful pull transfer');

    // 1. Get new CHW's primary catchment area
    const { data: chwCatchments, error: chwError } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community, branch_id')
      .eq('assigned_chw_id', chwUserId)
      .limit(1);

    if (chwError || !chwCatchments || chwCatchments.length === 0) {
      throw new ForbiddenException('CHW has no assigned catchment areas');
    }

    const newCatchment = chwCatchments[0];

    // 2. Get child's current info including existing catchment
    const { data: child, error: childError } = await this.db.supabase
      .from('children')
      .select('id, full_name, catchment_area_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      throw new NotFoundException(`Child with ID ${childId} not found`);
    }

    // Check if child is already in this CHW's catchment
    if (child.catchment_area_id === newCatchment.id) {
      return {
        success: true,
        message: `${child.full_name} is already in your catchment area`,
        childId: child.id,
        childName: child.full_name,
        previousCatchment: newCatchment.name,
        newCatchment: newCatchment.name,
        wasPulled: false,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Get old catchment info (for audit logging)
    let oldCatchmentName = 'None (unassigned)';
    let oldCatchmentBranchId: string | null = null;
    let oldCatchmentId: string | null = child.catchment_area_id;

    if (child.catchment_area_id) {
      const { data: oldCatchment } = await this.db.supabase
        .from('catchment_areas')
        .select('id, name, branch_id, assigned_chw_id')
        .eq('id', child.catchment_area_id)
        .single();

      if (oldCatchment) {
        oldCatchmentName = oldCatchment.name;
        oldCatchmentBranchId = oldCatchment.branch_id;
      }
    }

    // 4. Update child's catchment_area_id to new CHW's catchment
    const { error: updateError } = await this.db.supabase
      .from('children')
      .update({
        catchment_area_id: newCatchment.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', childId);

    if (updateError) {
      throw new BadRequestException(`Transfer pull failed: ${updateError.message}`);
    }

    const timestamp = new Date().toISOString();

    // 5. Log TRANSFER OUT for the OLD catchment's branch
    // This creates a +1 Transfer Out record for the old branch manager's stats
    if (oldCatchmentId) {
      await this.db.supabase.from('audit_logs').insert({
        user_id: chwUserId, // The CHW who initiated the pull
        action: 'transfer_out',
        resource_type: 'child',
        resource_id: childId,
        details: {
          childName: child.full_name,
          fromCatchment: oldCatchmentName,
          fromCatchmentId: oldCatchmentId,
          fromBranchId: oldCatchmentBranchId,
          toCatchment: newCatchment.name,
          toCatchmentId: newCatchment.id,
          toBranchId: newCatchment.branch_id,
          transferType: 'pull', // Marks this as a pull transfer (not manual release)
          notes: notes || 'Child pulled to new catchment area',
          timestamp,
        },
      });
    }

    // 6. Log TRANSFER IN for the NEW catchment's branch
    // This creates a +1 Transfer In record for the new branch manager's stats
    await this.db.supabase.from('audit_logs').insert({
      user_id: chwUserId,
      action: 'transfer_in',
      resource_type: 'child',
      resource_id: childId,
      details: {
        childName: child.full_name,
        fromCatchment: oldCatchmentName,
        fromCatchmentId: oldCatchmentId,
        fromBranchId: oldCatchmentBranchId,
        toCatchment: newCatchment.name,
        toCatchmentId: newCatchment.id,
        toBranchId: newCatchment.branch_id,
        transferType: 'pull', // Marks this as a pull transfer
        notes: notes || 'Child pulled via global search',
        timestamp,
      },
    });

    this.logger.log(
      `[CHW TransferPull] Child ${child.full_name} pulled from ${oldCatchmentName} to ${newCatchment.name}`,
    );

    return {
      success: true,
      message: `${child.full_name} has been transferred to your catchment area.`,
      childId: child.id,
      childName: child.full_name,
      previousCatchment: oldCatchmentName,
      newCatchment: newCatchment.name,
      newCatchmentId: newCatchment.id,
      wasPulled: true,
      timestamp,
    };
  }

  /**
   * Get CHW's local register (children in their catchment)
   * Uses child's direct catchment_area_id instead of guardian's
   */
  async getLocalRegister(chwUserId: string) {
    this.logger.debug('[CHW getLocalRegister] Fetching local register');

    // Get CHW's catchment areas
    const { data: catchments } = await this.db.supabase
      .from('catchment_areas')
      .select('id, name, community')
      .eq('assigned_chw_id', chwUserId);

    if (!catchments || catchments.length === 0) {
      this.logger.debug('[CHW getLocalRegister] No catchments assigned');
      return [];
    }

    const catchmentIds = catchments.map(c => c.id);

    // Query children directly by catchment_area_id
    const { data: children, error } = await this.db.supabase
      .from('children')
      .select(`
        id,
        cvcc_id,
        full_name,
        date_of_birth,
        gender,
        primary_facility_id,
        catchment_area_id,
        child_guardian!inner (
          is_primary,
          guardians (
            id,
            full_name,
            phone_primary
          )
        )
      `)
      .in('catchment_area_id', catchmentIds)
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      throw new BadRequestException(`Failed to fetch local register: ${error.message}`);
    }

    // Transform to frontend format
    const register = (children || []).map((child: any) => {
      const primaryGuardian = (child.child_guardian || [])
        .find((cg: any) => cg.is_primary && cg.guardians)
        ?.guardians;

      return {
        id: child.id,
        cvccId: child.cvcc_id,
        fullName: child.full_name,
        dateOfBirth: child.date_of_birth,
        gender: child.gender,
        primaryFacilityId: child.primary_facility_id,
        catchmentAreaId: child.catchment_area_id,
        guardianName: primaryGuardian?.full_name || 'Unknown',
        guardianPhone: primaryGuardian?.phone_primary || 'N/A',
      };
    });

    this.logger.debug(`[CHW getLocalRegister] Register retrieved successfully`);

    return register;
  }
}
