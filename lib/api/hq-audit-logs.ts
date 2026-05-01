import { apiRequest } from './config';

export interface HqAuditLog {
  id: string;
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  category: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface HqAuditLogFilters {
  action?: string;
  entityType?: string;
  category?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface HqAuditLogResponse {
  data: HqAuditLog[];
  pagination: { limit: number; offset: number; returned: number };
}

type RawAuditLog = {
  id?: string;
  user_id?: string;
  userId?: string;
  user_name?: string;
  userName?: string;
  action?: string;
  entity_type?: string;
  entityType?: string;
  entity_id?: string;
  entityId?: string;
  category?: string;
  before_data?: Record<string, any>;
  beforeData?: Record<string, any>;
  after_data?: Record<string, any>;
  afterData?: Record<string, any>;
  ip_address?: string;
  ipAddress?: string;
  user_agent?: string;
  userAgent?: string;
  created_at?: string;
  timestamp?: string;
};

const GENERIC_CATEGORIES = new Set(["clinical", "general", "unknown", "other"]);

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Authentication",
  authentication: "Authentication",
  user: "User Management",
  users: "User Management",
  branch: "Branch Operations",
  branches: "Branch Operations",
  vaccine: "Vaccine Management",
  vaccines: "Vaccine Management",
  schedule: "Vaccine Management",
  system: "System Changes",
  notification: "Notifications",
  notifications: "Notifications",
  child: "Child Records",
  children: "Child Records",
  guardian: "Guardian Records",
  guardians: "Guardian Records",
  parent: "Guardian Records",
  parents: "Guardian Records",
};

const ENTITY_LABELS: Record<string, string> = {
  users: "User Account",
  user: "User Account",
  branches: "Branch",
  branch: "Branch",
  children: "Child",
  child: "Child",
  guardians: "Guardian",
  guardian: "Guardian",
  parents: "Guardian",
  vaccines: "Vaccine",
  vaccine: "Vaccine",
  schedules: "Schedule",
  schedule: "Schedule",
  notifications: "Notification",
  notification: "Notification",
  audit_logs: "Audit Log",
  system_settings: "System Settings",
  backup_settings: "Backup Settings",
};

const toTitleCase = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const normalizeCategory = (value?: string): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/[_-]+/g, " ").trim();
  return CATEGORY_LABELS[normalized] ?? toTitleCase(normalized);
};

const normalizeEntityType = (value?: string): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/[_-]+/g, " ").trim();
  return ENTITY_LABELS[normalized] ?? toTitleCase(normalized);
};

const deriveCategory = (action: string, entityType?: string): string => {
  const lowerAction = action.toLowerCase();
  const lowerEntity = (entityType ?? "").toLowerCase();

  if (lowerAction.includes("login") || lowerAction.includes("logout") || lowerAction.includes("auth")) return "Authentication";
  if (lowerAction.includes("notification") || lowerAction.includes("sms") || lowerAction.includes("email") || lowerEntity.includes("notification")) return "Notifications";
  if (lowerAction.includes("user") || lowerAction.includes("password") || lowerEntity.includes("user")) return "User Management";
  if (lowerAction.includes("branch") || lowerAction.includes("chw") || lowerEntity.includes("branch")) return "Branch Operations";
  if (lowerAction.includes("vaccine") || lowerAction.includes("schedule") || lowerEntity.includes("vaccine")) return "Vaccine Management";
  if (lowerAction.includes("child") || lowerEntity.includes("child")) return "Child Records";
  if (lowerAction.includes("guardian") || lowerAction.includes("parent") || lowerEntity.includes("guardian")) return "Guardian Records";
  if (lowerAction.includes("backup") || lowerAction.includes("system") || lowerEntity.includes("system")) return "System Changes";
  return "System Changes";
};

const normalizeAuditLog = (raw: RawAuditLog): HqAuditLog => {
  const action = raw.action ?? "Action recorded";
  const rawEntityType = raw.entity_type ?? raw.entityType ?? "";
  const entityType = normalizeEntityType(rawEntityType);
  const rawCategory = raw.category ?? "";
  const normalizedCategory = normalizeCategory(rawCategory);
  const rawCategoryLower = rawCategory.trim().toLowerCase();
  const shouldDeriveCategory = !normalizedCategory || (rawCategoryLower && GENERIC_CATEGORIES.has(rawCategoryLower));
  const category = shouldDeriveCategory ? deriveCategory(action, rawEntityType) : normalizedCategory;

  return {
    id: raw.id ?? "unknown",
    userId: raw.user_id ?? raw.userId ?? "unknown",
    userName: raw.user_name ?? raw.userName,
    action,
    entityType,
    entityId: raw.entity_id ?? raw.entityId,
    category,
    beforeData: raw.before_data ?? raw.beforeData,
    afterData: raw.after_data ?? raw.afterData,
    ipAddress: raw.ip_address ?? raw.ipAddress,
    userAgent: raw.user_agent ?? raw.userAgent,
    timestamp: raw.created_at ?? raw.timestamp ?? new Date().toISOString(),
  };
};

export async function getHqAuditLogs(filters?: HqAuditLogFilters): Promise<HqAuditLogResponse> {
  const params = new URLSearchParams();

  if (filters?.action) params.append('action', filters.action);
  if (filters?.entityType) params.append('entityType', filters.entityType);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  const url = `/hq-admin/audit-logs${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{ data: RawAuditLog[]; pagination: { limit: number; offset: number; returned: number } }>(url);
  return {
    data: (response.data ?? []).map(normalizeAuditLog),
    pagination: response.pagination,
  };
}
