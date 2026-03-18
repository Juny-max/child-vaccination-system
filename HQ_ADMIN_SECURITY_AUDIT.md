# HQ Admin Implementation Security Audit Report

**Date:** March 18, 2026
**Scope:** Child Vaccination System - HQ Admin Module
**Audit Focus:** Backend (`backend/src/branch-manager/**`) & Frontend (`app/hq/**`)

---

## Executive Summary

The HQ admin implementation demonstrates good foundational security practices with JWT authentication, role-based access control, and proper use of parameterized queries. However, **critical password security issues** and **debug logging vulnerabilities** require immediate remediation.

**Overall Risk Level:** 🔴 **HIGH** (due to password hashing)

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. **Insecure Password Hashing (SHA256)**

**Location:**

- [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1419-L1420)

- [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts#L407-L408)

**Issue:**

```typescript
// ❌ INSECURE - SHA256 is NOT suitable for password hashing
private hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

```

**Risk:**

- SHA256 is fast and designed for checksums, not password protection

- Attacker can perform **millions of hash attempts per second**

- **No salt** is used, enabling rainbow table attacks

- All passwords can be brute-forced relatively quickly on modern hardware

**Impact:** CRITICAL - All user accounts vulnerable
**CWE:** CWE-327 (Use of Broken/Risky Crypto Algorithm)

**Recommendation:**

```typescript
// ✅ SECURE - Use bcrypt with salt
import * as bcrypt from 'bcrypt';

private async hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10); // 10 rounds
}

private async verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

```

**Action Items:**
1. Install bcrypt: `npm install bcrypt && npm install --save-dev @types/bcrypt`
2. Replace SHA256 hashing in both `auth.service.ts` and `branch-manager.service.ts`
3. Migrate existing password hashes using a one-way migration on user login
4. Update DTOs if password strength requirements change

---

### 2. **Missing @NotEmpty Validator on Required Field**

**Location:** [backend/src/branch-manager/hq-catchment-areas.dto.ts](backend/src/branch-manager/hq-catchment-areas.dto.ts#L8)

**Issue:**

```typescript
export class CreateHqCatchmentAreaDto {
  // ❌ Missing @IsNotEmpty()
  @IsUUID()
  branchId: string;

```

**Risk:**

- `branchId` could be `undefined`, passing validation but causing runtime errors

- Inconsistent validation with other required UUID fields

- Could result in database constraint violations

**Action Item:**

```typescript
export class CreateHqCatchmentAreaDto {
  @IsNotEmpty()  // ✅ ADD THIS
  @IsUUID()
  branchId: string;

```

---

### 3. **Debug Logging of Sensitive Data in Production**

**Location:** [backend/src/chw/chw.service.ts](backend/src/chw/chw.service.ts#L92-L103,L142,L178,L229-L232,L283-L284,L317,L346,L348,L391)

**Issue:**

```typescript
console.log(`[CHW getAssignedChildren] User ID: ${chwUserId}`);
console.log(`[CHW Search] Query: "${query}"`);
console.log(`[CHW Search All] Guardians found by phone: ${(guardiansByPhone || []).length}`);
console.log('[CHW Search All] Sample guardian phone:', (guardiansByPhone || [])[0]?.phone_primary);

```

**Risk:**

- Personal health information (phone numbers) logged to console/logs

- User IDs and search patterns exposed in production logs

- **Violates data privacy regulations** (GDPR, HIPAA standards)

- Logs may be aggregated and stored, creating long-term exposure

**Impact:** HIGH - Privacy violation, compliance issue
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File)

**Action Items:**
1. Remove all `console.log()` statements from production code
2. Replace with structured logging using Logger:
   ```typescript
   this.logger.debug('Sensitive data retrieval', { userId: anonymizeId(chwUserId) });
   ```

3. Configure logging levels for different environments
4. Never log: phone numbers, emails, personal names, full IDs

---

## 🟠 HIGH SEVERITY ISSUES (Fix Soon)

### 1. **Incomplete Authorization Check on resetHqUserPassword**

**Location:** [backend/src/branch-manager/hq-users.controller.ts](backend/src/branch-manager/hq-users.controller.ts#L56-L57)

**Issue:**

```typescript
@Post('reset-password')
async resetPassword(@Body() dto: ResetHqUserPasswordDto) {
  // ✅ Has @UseGuards and @Roles at class level, so this is OK
  // But pattern is different from other endpoints
  return this.branchManagerService.resetHqUserPassword(dto.email);
}

```

**Status:** ✅ ACTUALLY SECURE - Controller has class-level `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('hq-admin')`

But recommend explicit decorators on method for clarity:

```typescript
@Post('reset-password')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
async resetPassword(@Body() dto: ResetHqUserPasswordDto) {
  return this.branchManagerService.resetHqUserPassword(dto.email);
}

```

---

### 2. **Email Information Disclosure (Timing Attack Risk)**

**Location:** [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1344-L1390)

**Issue:**

```typescript
async resetHqUserPassword(email: string) {
  const { data: user, error: userError } = await db
    .from('users')
    .select('id, email, full_name')
    .eq('email', normalizedEmail)
    .single();  // ✅ Returns NotFoundException if not found

  if (userError || !user) {
    throw new NotFoundException({
      message: `User not found for email ${normalizedEmail}`,  // ⚠️ Email disclosed
      code: 'USER_NOT_FOUND',
    });
  }
}

```

**Risk:**

- **Timing attack:** Response time differs when user exists vs. doesn't exist

- **Email enumeration:** Attacker can discover valid email addresses

- Error message reveals whether email exists in system

**Note:** The code does attempt to normalize emails (trim, lowercase) - good practice

**Recommendation:**

```typescript
async resetHqUserPassword(email: string) {
  const lowerEmail = email.trim().toLowerCase();
  const { data: user } = await db
    .from('users')
    .select('id, email, full_name')
    .eq('email', lowerEmail)
    .maybeSingle();

  // ✅ Same response for both success and failure
  if (user) {
    const temporaryPassword = this.generateTemporaryPassword();
    // ... proceed with reset
  }

  return {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  };
}

```

---

### 3. **No Rate Limiting on Authentication/Password Endpoints**

**Location:** Backend authentication and password reset endpoints

**Issue:**

- No rate limiting visible on:
  - Login endpoint
  - Password reset endpoint
  - User creation endpoint

- Attackers can brute force credentials

**Risk:**

- **Credential stuffing attacks** not prevented

- **DoS attacks** on password reset

- **Mass account creation** not rate limited

**Recommendation - Install rate limiting middleware:**

```bash
npm install @nestjs/throttler

```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,     // 1 minute window
      limit: 5,       // 5 requests per window
    }]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

```

Apply specific limits to sensitive endpoints:

```typescript
@Post('reset-password')
@Throttle({ default: { limit: 3, ttl: 3600000 } })
async resetPassword(@Body() dto: ResetHqUserPasswordDto) {
  // Only 3 resets per hour per IP
}

```

---

## 🟡 MEDIUM SEVERITY ISSUES (Should Fix)

### 1. **Database Error Messages May Leak Information**

**Location:** Multiple service methods

**Issue:**

```typescript
throw new BadRequestException({
  message: `Failed to create user: ${createError?.message ?? 'unknown error'}`,
  code: 'HQ_USER_CREATE_FAILED',
});

```

**Risk:**

- Supabase error messages may reveal schema structure

- Database validation errors could expose column names, constraints

- Example: `Duplicate key value violates unique constraint "users_email_key"`

**Recommendation:**

```typescript
try {
  const { data: createdUser, error: createError } = await db
    .from('users')
    .insert({...})
    .select('id')
    .single();

  if (createError || !createdUser) {
    this.logger.error('User creation failed', {
      code: createError?.code,
      details: createError
    });

    // ✅ Generic message to client
    throw new BadRequestException({
      message: 'Unable to create user. Please verify your input.',
      code: 'HQ_USER_CREATE_FAILED',
    });
  }
} catch (error) {
  if (error instanceof BadRequestException) throw error;
  throw new InternalServerErrorException('An unexpected error occurred');
}

```

---

### 2. **Insufficient Input Validation Pattern**

**Location:** [backend/src/branch-manager/hq-system-settings.dto.ts](backend/src/branch-manager/hq-system-settings.dto.ts)

**Issue:**

```typescript
export class CreateHqSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  id: string;  // ⚠️ No max length

  @IsString()
  @IsNotEmpty()
  category: string;  // ⚠️ No max length

  @IsNotEmpty()
  value: any;  // ⚠️ ANY TYPE - No validation!
}

```

**Risk:**

- `value: any` accepts any data type including malicious payloads

- No length constraints allows potential database load attacks

- Setting IDs could be excessively long

**Recommendation:**

```typescript
export class CreateHqSystemSettingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsNotEmpty()
  @ValidateNested()  // Validate nested objects
  value: Record<string, unknown>;  // More specific than 'any'
}

```

---

### 3. **Missing Transaction Boundary for Critical Operations**

**Location:** [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1174-L1250)

**Issue:**

```typescript
async createHqUser(dto: CreateHqUserDto, actorUserId?: string) {
  // Step 1: Create user
  const { data: createdUser } = await db.from('users').insert({...}).single();

  // Step 2: Send email (can fail independently)
  await this.emailService.sendStaffInviteEmail({...}, temporaryPassword);

  // ⚠️ No rollback if email fails!
  return users.find((item) => item.id === createdUser.id);
}

```

**Risk:**

- User created but email not sent - user locked out

- No audit trail of failure reason

- Inconsistent system state possible

**Recommendation:**

```typescript
async createHqUser(dto, actorUserId) {
  try {
    const { data: createdUser } = await db.from('users').insert({...});

    try {
      await this.emailService.sendStaffInviteEmail({...}, temporaryPassword);
    } catch (emailError) {
      // Log email failure but don't fail the request
      this.logger.warn('Email delivery failed during user creation', {
        userId: createdUser.id,
        email: normalizedEmail,
        error: emailError.message,
      });

      // Optionally retry or queue for later
    }

    return users.find(u => u.id === createdUser.id);
  } catch (error) {
    // If user insert fails, email isn't sent
    throw error;
  }
}

```

---

## 🟢 LOW SEVERITY ISSUES (Nice to Fix)

### 1. **Non-Sensitive Console Logging in main.ts**

**Location:** [backend/src/main.ts](backend/src/main.ts#L69-L70)

**Issue:**

```typescript
console.log(`🚀 Backend server running on http://localhost:${port}`);
console.log(`📚 API available at http://localhost:${port}/api`);

```

**Status:** ℹ️ Low risk - non-sensitive startup messages

**Recommendation:** Use Logger instead:

```typescript
const logger = new Logger('Bootstrap');
logger.log(`🚀 Backend server running on http://localhost:${port}`);
logger.log(`📚 API available at http://localhost:${port}/api`);

```

---

### 2. **Temporary Passwords in Email Could Be Visible in Email Archives**

**Location:** [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1208-L1241)

**Issue:**

- Temporary password sent in email body (via `sendStaffInviteEmail`)

- Email may be archived indefinitely

- Screenshots/forwards expose password

**Recommendation:**
1. Send **login link with token** instead of password:
   ```

   Click here to set your password: https://app.com/setup-password?token=...
   ```

2. Use time-limited tokens (15 minutes)
3. Token valid only once

---

### 3. **CSRF Protection Not Evident**

**Location:** Backend endpoints

**Issue:**

- No visible CSRF token validation

- Supabase client side may handle this

**Note:** ✅ If using Supabase with stateless JWT, CSRF less critical (GET requests are read-only, POST requires bearer token)

**Verify:** State-changing operations (POST/PUT/DELETE) require Authorization header (JWT), which cannot be initiated by cross-site forms.

---

## ✅ SECURITY CHECKS PASSED

### 1. **JWT Authentication on All Protected Routes**

**Status:** ✅ PASS

All HQ admin endpoints properly protected:

```typescript
@Controller('hq-admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)  // ✅
@Roles('hq-admin')
export class HqUsersController { }

```

**Verified on:**

- HqUsersController

- HqBranchesController

- HqVaccinesController

- HqCatchmentAreasController

- HqSystemSettingsController

- HqAnalyticsController

- HqAuditLogsController

---

### 2. **Role-Based Access Control (RBAC)**

**Status:** ✅ PASS

```typescript
@Roles('hq-admin')  // Only HQ admins access HQ endpoints

```

Guards implementation properly checks roles:

```typescript
const hasRole = requiredRoles.some((role) => user.role === role);
if (!hasRole) {
  throw new ForbiddenException(`This resource requires one of: ${requiredRoles.join(',')}`);
}

```

---

### 3. **HQ Admin Role Cannot Be Created by HQ Admins**

**Status:** ✅ PASS - EXCELLENT SECURITY MEASURE

**Location:** [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1458-L1492)

```typescript
private async assertHqAdminRoleProvisioningAllowed(role: string, context) {
  if (role !== 'hq-admin') return;  // Only check for HQ admin role

  this.logger.warn(`Blocked HQ Admin role provisioning attempt`);
  await this.databaseService.createAuditLog(...);  // Audit blocked attempt

  throw new ForbiddenException({
    message: 'HQ Admin role cannot be created or assigned from this console.',
    code: 'HQ_ADMIN_ROLE_FORBIDDEN',
  });
}

```

**Called on:** `createHqUser()` and `updateHqUserRole()`
**Audit logged:** Yes ✅

---

### 4. **Email Input Validation**

**Status:** ✅ PASS

```typescript
@IsEmail()
email!: string;

```

Email normalized before storage:

```typescript
const normalizedEmail = dto.email.trim().toLowerCase();

```

---

### 5. **SQL Injection Protection**

**Status:** ✅ PASS - Using Supabase ORM

All database operations use Supabase client with parameterized queries:

```typescript
const { data } = await db
  .from('users')
  .select('id')
  .eq('email', normalizedEmail)  // ✅ Parameterized
  .single();

```

No raw SQL queries found.

---

### 6. **CORS Configuration**

**Status:** ✅ PASS

**Location:** [backend/src/main.ts](backend/src/main.ts#L42-L46)

```typescript
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

```

✅ Origins configurable via environment
✅ Credentials enabled
✅ Proper method whitelist

---

### 7. **Security Headers with Helmet**

**Status:** ✅ PASS

**Location:** [backend/src/main.ts](backend/src/main.ts#L18-L40)

```typescript
app.use(helmet({
  contentSecurityPolicy: { /* proper directives */ },
  hsts: { maxAge: 31536000 },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

```

✅ CSP configured
✅ HSTS enabled
✅ Clickjacking protection
✅ XSS filter enabled

---

### 8. **HTML Sanitization with DOMPurify**

**Status:** ✅ PASS

**Location:** [app/hq/dashboard/page.tsx](app/hq/dashboard/page.tsx#L450-L451,L2513)

```typescript
const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html);

// Usage:
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(templatePreview) }} />

```

✅ DOMPurify prevents XSS
✅ Safe to render dynamic HTML

---

### 9. **Dependency Checking Before Deletion**

**Status:** ✅ PASS - Prevents Cascade Delete Issues

**Location:** [backend/src/branch-manager/branch-manager.service.ts](backend/src/branch-manager/branch-manager.service.ts#L1069-L1120)

```typescript
async deleteHqBranch(code: string) {
  // Check for dependent records BEFORE deletion
  const [staffCount, childrenCount, catchmentCount] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
    db.from('children').select('id', { count: 'exact', head: true }).eq('primary_facility_id', branch.id),
    db.from('catchment_areas').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
  ]);

  if (issues.length > 0) {
    throw new BadRequestException({
      message: `Cannot delete branch. It has dependent records: ${issues.join(', ')}...`,
    });
  }

  // Only delete if no dependencies
  const { error } = await db.from('branches').delete().eq('id', branch.id);
}

```

✅ Prevents orphaned records
✅ User-friendly error messages
✅ Explicit confirmation required

---

### 10. **Audit Logging of Sensitive Operations**

**Status:** ✅ PASS

**Logged Operations:**

- ✅ Failed login attempts (password invalid)

- ✅ Account deactivation attempts

- ✅ Successful logins

- ✅ Token refreshes

- ✅ Blocked HQ admin role assignments

- ✅ Password reset requests

- ✅ User creation/updates

**Location:** [backend/src/auth/auth.service.ts](backend/src/auth/auth.service.ts) (multiple places)

```typescript
await this.databaseService.createAuditLog(
  'system',
  'access',
  'users',
  'unknown',
  { after: { event: 'failed_login', reason: 'invalid_email' } }
);

```

---

### 11. **Input Validation with Class Validators**

**Status:** ✅ PASS (mostly)

All DTOs use `class-validator` decorators:

- `@IsString()`

- `@IsEmail()`

- `@IsEnum()`

- `@MinLength()`

- `@MaxLength()`

- `@IsUUID()`

- `@IsNumber()`

**Global validation pipe enabled:**

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,  // Reject unknown properties
    transform: true,
  })
);

```

---

### 12. **No Hardcoded Credentials**

**Status:** ✅ PASS

All secrets retrieved from environment variables:

```typescript
const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

```

---

### 13. **Email Normalization**

**Status:** ✅ PASS

Emails trimmed and lowercased before database operations:

```typescript
const normalizedEmail = dto.email.trim().toLowerCase();

```

Prevents duplicate account creation with variations (e.g., `Admin@Example.com` vs `admin@example.com`)

---

## Summary Table

| # | Category | Issue | Severity | Status |
|---|----------|-------|----------|--------|
| 1 | Password Security | SHA256 instead of bcrypt | 🔴 CRITICAL | ❌ FAIL |
| 2 | Input Validation | Missing @NotEmpty on branchId | 🔴 CRITICAL | ❌ FAIL |
| 3 | Data Privacy | Debug logging of PII | 🔴 CRITICAL | ❌ FAIL |
| 4 | Rate Limiting | No rate limiting on auth endpoints | 🟠 HIGH | ❌ FAIL |
| 5 | Error Handling | Database errors leaked to client | 🟡 MEDIUM | ⚠️ PARTIAL |
| 6 | Input Validation | `value: any` in system settings | 🟡 MEDIUM | ❌ FAIL |
| 7 | Transactions | No rollback on email failure | 🟡 MEDIUM | ⚠️ ACCEPTABLE |
| 8 | Email Security | Password in email vulnerable | 🟢 LOW | ⚠️ ACCEPTABLE |
| 9 | Logging | Non-sensitive console.log | 🟢 LOW | ✅ PASS |
| 10 | JWT Security | All endpoints properly protected | ✅ | ✅ PASS |
| 11 | RBAC | Role guards on all endpoints | ✅ | ✅ PASS |
| 12 | Authorization | HQ admin creation blocked | ✅ | ✅ PASS |
| 13 | Email Validation | IsEmail decorator + normalization | ✅ | ✅ PASS |
| 14 | SQL Injection | Parameterized queries (Supabase) | ✅ | ✅ PASS |
| 15 | CORS | Env-configurable origins | ✅ | ✅ PASS |
| 16 | Security Headers | Helmet with CSP, HSTS, etc | ✅ | ✅ PASS |
| 17 | HTML Sanitization | DOMPurify usage | ✅ | ✅ PASS |
| 18 | Data Integrity | Dependency checking on delete | ✅ | ✅ PASS |
| 19 | Audit Trail | Comprehensive audit logging | ✅ | ✅ PASS |
| 20 | Credentials | No hardcoded secrets | ✅ | ✅ PASS |

**Final Score: 15/20 (75%)**

---

## Remediation Priority

### 🔴 IMMEDIATE (Next 24-48 hours)

1. **Replace SHA256 with bcrypt** - Password security is foundational
2. **Remove debug console.log()** statements - Privacy/compliance issue
3. **Add @NotEmpty() to branchId** - Simple 1-line fix

### 🟠 URGENT (This Week)

4. Implement rate limiting
5. Improve error message handling
6. Validate `value: any` field in system settings

### 🟡 NEAR-TERM (Next Sprint)

7. Replace temporary passwords with login links
8. Implement transaction boundaries for multi-step operations
9. Add explicit CSRF tokens if needed

### 🟢 OPTIONAL (Backlog)

10. Replace console.log with structured Logger
11. Implement timing attack mitigation for email enumeration

---

## Testing Recommendations

```bash
# Test password hashing

npm test -- password.spec.ts

# Test rate limiting

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/hq-admin/users/reset-password \
  -d '{"email":"test@example.com"}' -X POST \
  # Repeat 10 times - should fail after 3rd attempt

# Test XSS protection

POST /api/hq-admin/system-settings
{
  "value": "<script>alert('xss')</script>"
}
# Should sanitize or reject

# Test unauthorized access

curl http://localhost:3001/api/hq-admin/branches \
  # Should return 401 without JWT

# Test RBAC

curl -H "Authorization: Bearer $NURSE_JWT" \
  http://localhost:3001/api/hq-admin/branches \
  # Should return 403 (Forbidden)

```

---

## Conclusion

The HQ admin implementation has a **solid security foundation** with proper authentication, authorization, and SQL injection protection. However, **password hashing vulnerability is a critical security flaw** that must be fixed before production deployment. The debug logging of PII is a **compliance risk** that requires immediate remediation.

With the remediation of critical issues, this system can achieve enterprise-grade security standards.

**Recommendation:** ✅ **Proceed with fixes, then re-audit before production release**
