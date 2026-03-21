/**
 * Facility and Branch Manager Admin Tool
 *
 * Run with:
 *   cd backend
 *   npx ts-node scripts/manage-facilities.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type BranchMetadata = {
  managerName?: string;
  assignedChwNames?: string[];
  [key: string]: unknown;
};

type BranchRow = {
  id: string;
  name: string;
  code: string;
  district: string | null;
  region: string | null;
  status: string | null;
  manager_id: string | null;
  metadata: BranchMetadata | null;
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string | null;
  branch_id: string | null;
};

const CANCEL_INPUTS = new Set(['q', 'quit', 'cancel', 'exit']);

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function isCancel(input: string): boolean {
  return CANCEL_INPUTS.has(normalize(input));
}

function toMetadata(value: unknown): BranchMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as BranchMetadata;
}

function line(width = 100): string {
  return '-'.repeat(width);
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function promptRequired(
  rl: readline.Interface,
  label: string,
  minLength = 2,
): Promise<string | null> {
  while (true) {
    const value = (await ask(rl, `${label} (or q to cancel): `)).trim();
    if (isCancel(value)) return null;

    if (value.length < minLength) {
      console.log(`Please enter at least ${minLength} characters.`);
      continue;
    }

    return value;
  }
}

async function promptOptional(
  rl: readline.Interface,
  label: string,
  fallback = '',
): Promise<string | null> {
  const value = (await ask(rl, `${label} (press Enter for "${fallback}", or q to cancel): `)).trim();
  if (isCancel(value)) return null;
  return value || fallback;
}

async function promptIndex(
  rl: readline.Interface,
  itemCount: number,
  label: string,
): Promise<number | null> {
  while (true) {
    const input = (await ask(rl, `${label} [1-${itemCount}] (or q to cancel): `)).trim();
    if (isCancel(input)) return null;

    const parsed = Number.parseInt(input, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= itemCount) {
      return parsed - 1;
    }

    console.log('Invalid selection. Enter a valid number from the list.');
  }
}

async function fetchBranches(): Promise<BranchRow[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, code, district, region, status, manager_id, metadata')
    .order('code', { ascending: true });

  if (error) {
    throw new Error(`Failed to load facilities: ${error.message}`);
  }

  return (data ?? []) as BranchRow[];
}

async function fetchUsersByIds(userIds: string[]): Promise<Map<string, UserRow>> {
  if (!userIds.length) return new Map<string, UserRow>();

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, branch_id')
    .in('id', userIds);

  if (error) {
    throw new Error(`Failed to load user lookup: ${error.message}`);
  }

  const result = new Map<string, UserRow>();
  (data ?? []).forEach((user) => {
    result.set(user.id, user as UserRow);
  });

  return result;
}

async function fetchBranchManagers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, branch_id')
    .eq('role', 'branch-manager')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to load branch managers: ${error.message}`);
  }

  return (data ?? []) as UserRow[];
}

async function generateNextBranchCode(): Promise<string> {
  const { data, error } = await supabase
    .from('branches')
    .select('code');

  if (error) {
    throw new Error(`Failed to generate branch code: ${error.message}`);
  }

  const maxCode = (data ?? []).reduce((highest, row) => {
    const parsed = Number.parseInt(String(row.code ?? '').replace('BR-', ''), 10);
    if (Number.isNaN(parsed)) return highest;
    return Math.max(highest, parsed);
  }, 0);

  return `BR-${String(maxCode + 1).padStart(3, '0')}`;
}

async function listFacilities(): Promise<void> {
  const facilities = await fetchBranches();

  if (!facilities.length) {
    console.log('\nNo facilities found. Create one first.\n');
    return;
  }

  const managerIds = Array.from(
    new Set(
      facilities
        .map((branch) => branch.manager_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const managerLookup = await fetchUsersByIds(managerIds);

  console.log(`\n${line()}`);
  console.log('FACILITIES');
  console.log(line());

  facilities.forEach((facility, index) => {
    const managerFromId = facility.manager_id ? managerLookup.get(facility.manager_id) : undefined;
    const metadata = toMetadata(facility.metadata);
    const managerName = managerFromId?.full_name || metadata.managerName || 'Unassigned';

    console.log(`${index + 1}. ${facility.code} | ${facility.name}`);
    console.log(`   District: ${facility.district || 'N/A'} | Region: ${facility.region || 'N/A'} | Status: ${facility.status || 'unknown'}`);
    console.log(`   Manager:  ${managerName}`);
  });

  console.log(`${line()}\n`);
}

async function createFacility(rl: readline.Interface): Promise<void> {
  console.log(`\n${line()}`);
  console.log('CREATE FACILITY');
  console.log(line());

  const name = await promptRequired(rl, 'Facility name');
  if (name === null) {
    console.log('Cancelled.');
    return;
  }

  const district = await promptRequired(rl, 'District');
  if (district === null) {
    console.log('Cancelled.');
    return;
  }

  const region = await promptOptional(rl, 'Region', 'Unspecified');
  if (region === null) {
    console.log('Cancelled.');
    return;
  }

  const code = await generateNextBranchCode();
  const payload = {
    name,
    code,
    district,
    region,
    status: 'active',
    metadata: {
      managerName: 'Unassigned',
      assignedChwNames: [],
    },
  };

  const { data, error } = await supabase
    .from('branches')
    .insert(payload)
    .select('id, name, code, district, region, status')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create facility: ${error?.message ?? 'unknown error'}`);
  }

  console.log('\nFacility created successfully.');
  console.log(`Code: ${data.code}`);
  console.log(`Name: ${data.name}`);
  console.log(`District: ${data.district || 'N/A'}`);
  console.log(`Region: ${data.region || 'N/A'}\n`);
}

async function assignBranchManager(rl: readline.Interface): Promise<void> {
  const facilities = await fetchBranches();

  if (!facilities.length) {
    console.log('\nNo facilities found. Create one first.\n');
    return;
  }

  console.log(`\n${line()}`);
  console.log('SELECT FACILITY');
  console.log(line());

  const managerLookup = await fetchUsersByIds(
    Array.from(
      new Set(
        facilities
          .map((branch) => branch.manager_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );

  facilities.forEach((facility, index) => {
    const manager = facility.manager_id ? managerLookup.get(facility.manager_id) : undefined;
    const metadata = toMetadata(facility.metadata);
    const managerName = manager?.full_name || metadata.managerName || 'Unassigned';
    console.log(`${index + 1}. ${facility.code} | ${facility.name} | Manager: ${managerName}`);
  });

  const facilityIndex = await promptIndex(rl, facilities.length, 'Select facility');
  if (facilityIndex === null) {
    console.log('Cancelled.');
    return;
  }

  const selectedFacility = facilities[facilityIndex];
  const managers = await fetchBranchManagers();

  if (!managers.length) {
    console.log('\nNo users with role branch-manager found.\n');
    return;
  }

  const branchById = new Map<string, BranchRow>();
  facilities.forEach((branch) => {
    branchById.set(branch.id, branch);
  });

  console.log(`\n${line()}`);
  console.log('SELECT BRANCH MANAGER');
  console.log(line());

  managers.forEach((manager, index) => {
    const currentBranch = manager.branch_id ? branchById.get(manager.branch_id) : undefined;
    const assignment = currentBranch ? `${currentBranch.code} (${currentBranch.name})` : 'Unassigned';
    const status = manager.status || 'unknown';
    console.log(`${index + 1}. ${manager.full_name} | ${manager.email} | ${status} | Current: ${assignment}`);
  });

  const managerIndex = await promptIndex(rl, managers.length, 'Select manager');
  if (managerIndex === null) {
    console.log('Cancelled.');
    return;
  }

  const selectedManager = managers[managerIndex];
  const confirm = await ask(
    rl,
    `\nAssign ${selectedManager.full_name} to ${selectedFacility.name}? (y/N): `,
  );

  if (normalize(confirm) !== 'y' && normalize(confirm) !== 'yes') {
    console.log('Cancelled.');
    return;
  }

  const facilityMetadata = toMetadata(selectedFacility.metadata);
  const oldManagerId = selectedFacility.manager_id;

  if (selectedManager.branch_id && selectedManager.branch_id !== selectedFacility.id) {
    const { data: previousBranch, error: previousBranchError } = await supabase
      .from('branches')
      .select('id, name, manager_id, metadata')
      .eq('id', selectedManager.branch_id)
      .maybeSingle();

    if (previousBranchError) {
      throw new Error(`Failed to load manager previous facility: ${previousBranchError.message}`);
    }

    if (previousBranch && previousBranch.manager_id === selectedManager.id) {
      const previousMetadata = toMetadata(previousBranch.metadata);
      const { error: clearPreviousBranchError } = await supabase
        .from('branches')
        .update({
          manager_id: null,
          metadata: {
            ...previousMetadata,
            managerName: 'Unassigned',
          },
        })
        .eq('id', previousBranch.id);

      if (clearPreviousBranchError) {
        throw new Error(`Failed to clear manager from previous facility: ${clearPreviousBranchError.message}`);
      }
    }
  }

  if (oldManagerId && oldManagerId !== selectedManager.id) {
    const { data: oldManagerUser, error: oldManagerLookupError } = await supabase
      .from('users')
      .select('id, branch_id')
      .eq('id', oldManagerId)
      .maybeSingle();

    if (oldManagerLookupError) {
      throw new Error(`Failed to load existing assigned manager: ${oldManagerLookupError.message}`);
    }

    if (oldManagerUser?.branch_id === selectedFacility.id) {
      const { error: clearOldManagerError } = await supabase
        .from('users')
        .update({ branch_id: null })
        .eq('id', oldManagerId);

      if (clearOldManagerError) {
        throw new Error(`Failed to unassign previous manager user record: ${clearOldManagerError.message}`);
      }
    }
  }

  const { error: assignManagerUserError } = await supabase
    .from('users')
    .update({ branch_id: selectedFacility.id })
    .eq('id', selectedManager.id)
    .eq('role', 'branch-manager');

  if (assignManagerUserError) {
    throw new Error(`Failed to assign branch to manager user: ${assignManagerUserError.message}`);
  }

  const { error: assignManagerBranchError } = await supabase
    .from('branches')
    .update({
      manager_id: selectedManager.id,
      metadata: {
        ...facilityMetadata,
        managerName: selectedManager.full_name,
      },
    })
    .eq('id', selectedFacility.id);

  if (assignManagerBranchError) {
    throw new Error(`Failed to set manager on facility: ${assignManagerBranchError.message}`);
  }

  console.log('\nManager assignment updated.');
  console.log(`Facility: ${selectedFacility.code} | ${selectedFacility.name}`);
  console.log(`Manager:  ${selectedManager.full_name} (${selectedManager.email})\n`);
}

async function deleteFacility(rl: readline.Interface): Promise<void> {
  const facilities = await fetchBranches();

  if (!facilities.length) {
    console.log('\nNo facilities found.\n');
    return;
  }

  console.log(`\n${line()}`);
  console.log('DELETE FACILITY');
  console.log(line());
  console.log('Select a facility to delete. This action cannot be undone.\n');

  const managerLookup = await fetchUsersByIds(
    Array.from(
      new Set(
        facilities
          .map((branch) => branch.manager_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );

  facilities.forEach((facility, index) => {
    const managerFromId = facility.manager_id ? managerLookup.get(facility.manager_id) : undefined;
    const metadata = toMetadata(facility.metadata);
    const managerName = managerFromId?.full_name || metadata.managerName || 'Unassigned';
    console.log(`${index + 1}. ${facility.code} | ${facility.name} | Manager: ${managerName}`);
  });

  const facilityIndex = await promptIndex(rl, facilities.length, 'Select facility to delete');
  if (facilityIndex === null) {
    console.log('Cancelled.');
    return;
  }

  const selectedFacility = facilities[facilityIndex];

  const [staffCount, childrenCount, catchmentCount] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', selectedFacility.id),
    supabase
      .from('children')
      .select('id', { count: 'exact', head: true })
      .eq('primary_facility_id', selectedFacility.id),
    supabase
      .from('catchment_areas')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', selectedFacility.id),
  ]);

  const dependencyErrors = [
    staffCount.error,
    childrenCount.error,
    catchmentCount.error,
  ].filter((error) => Boolean(error));

  const invalidCounts =
    staffCount.count == null ||
    childrenCount.count == null ||
    catchmentCount.count == null;

  if (dependencyErrors.length > 0 || invalidCounts) {
    throw new Error('Failed to verify facility dependencies before deletion.');
  }

  const staffDependencies = staffCount.count ?? 0;
  const childrenDependencies = childrenCount.count ?? 0;
  const catchmentDependencies = catchmentCount.count ?? 0;

  if (staffDependencies > 0 || childrenDependencies > 0) {
    const issues: string[] = [];
    if (staffDependencies > 0) issues.push(`${staffDependencies} staff member(s)`);
    if (childrenDependencies > 0) issues.push(`${childrenDependencies} registered child(ren)`);
    if (catchmentDependencies > 0) issues.push(`${catchmentDependencies} catchment area(s)`);

    console.log('\nCannot delete this facility because dependent records exist:');
    issues.forEach((issue) => console.log(`- ${issue}`));
    console.log('Remove staff/children dependencies first, then try again.\n');
    return;
  }

  let shouldDeleteCatchments = false;
  if (catchmentDependencies > 0) {
    console.log(
      `\nThis facility has ${catchmentDependencies} catchment area(s).`,
    );
    const catchmentConfirm = await ask(
      rl,
      'Delete this facility together with its catchment areas? (y/N): ',
    );

    if (normalize(catchmentConfirm) !== 'y' && normalize(catchmentConfirm) !== 'yes') {
      console.log('Cancelled.');
      return;
    }

    shouldDeleteCatchments = true;
  }

  const confirmToken = await ask(
    rl,
    `\nType the facility code (${selectedFacility.code}) to confirm deletion, or q to cancel: `,
  );

  if (isCancel(confirmToken)) {
    console.log('Cancelled.');
    return;
  }

  if (confirmToken.trim() !== selectedFacility.code) {
    console.log('Confirmation failed. Facility not deleted.');
    return;
  }

  if (shouldDeleteCatchments) {
    const { error: deleteCatchmentError } = await supabase
      .from('catchment_areas')
      .delete()
      .eq('branch_id', selectedFacility.id);

    if (deleteCatchmentError) {
      throw new Error(`Failed to delete facility catchment areas: ${deleteCatchmentError.message}`);
    }
  }

  const { error: deleteError } = await supabase
    .from('branches')
    .delete()
    .eq('id', selectedFacility.id);

  if (deleteError) {
    throw new Error(`Failed to delete facility: ${deleteError.message}`);
  }

  console.log('\nFacility deleted successfully.');
  console.log(`Deleted: ${selectedFacility.code} | ${selectedFacility.name}\n`);
}

async function main(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('\nFacility Administration Tool');
    console.log(line());

    while (true) {
      console.log('\nChoose an option:');
      console.log('1. View hospitals/facilities');
      console.log('2. Create hospital/facility');
      console.log('3. Assign branch manager to hospital');
      console.log('4. Delete facility');
      console.log('5. Exit');

      const choice = (await ask(rl, '\nEnter choice (1-5): ')).trim();

      switch (choice) {
        case '1':
          await listFacilities();
          break;
        case '2':
          await createFacility(rl);
          break;
        case '3':
          await assignBranchManager(rl);
          break;
        case '4':
          await deleteFacility(rl);
          break;
        case '5':
          console.log('\nGoodbye.');
          return;
        default:
          console.log('Invalid choice. Please enter 1, 2, 3, 4, or 5.');
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nERROR: ${message}`);
  process.exit(1);
});
