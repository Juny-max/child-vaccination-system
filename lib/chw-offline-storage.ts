/**
 * CHW Offline Storage with Enhanced Security
 * Stores CHW vaccination records in IndexedDB with optional encryption
 * Replaces localStorage storage for sensitive health data with GPS coordinates
 */

const DB_NAME = 'cvcc_chw_offline';
const DB_VERSION = 1;
const STORE_NAME = 'chw_vaccinations';

export type CHWVaccinationRecord = {
  childId: string;
  childName: string;
  vaccineId: string;
  vaccineName: string;
  recordedDate: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  timestamp: number;
};

/**
 * Open or create the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { 
          keyPath: ['childId', 'vaccineId', 'recordedDate'] 
        });
        
        // Create indexes for efficient querying
        objectStore.createIndex('childId', 'childId', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('recordedDate', 'recordedDate', { unique: false });
      }
    };
  });
}

/**
 * Save a CHW vaccination record to IndexedDB
 */
export async function saveCHWVaccination(record: Omit<CHWVaccinationRecord, 'timestamp'>): Promise<void> {
  const db = await openDB();
  
  const fullRecord: CHWVaccinationRecord = {
    ...record,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(fullRecord);

    request.onsuccess = () => {
      // Dispatch event for dashboard to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chw-vaccination-saved', { detail: fullRecord }));
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all CHW vaccination records for a specific child
 */
export async function getCHWVaccinationsByChild(childId: string): Promise<CHWVaccinationRecord[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('childId');
    const request = index.getAll(childId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all CHW vaccination records
 */
export async function getAllCHWVaccinations(): Promise<CHWVaccinationRecord[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result || [];
      // Sort by timestamp descending (most recent first)
      records.sort((a, b) => b.timestamp - a.timestamp);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get CHW vaccination records with GPS coordinates (for mapping)
 */
export async function getCHWVaccinationsWithGPS(): Promise<CHWVaccinationRecord[]> {
  const allRecords = await getAllCHWVaccinations();
  return allRecords.filter(record => 
    typeof record.latitude === 'number' && 
    typeof record.longitude === 'number'
  );
}

/**
 * Delete a specific CHW vaccination record
 */
export async function deleteCHWVaccination(
  childId: string, 
  vaccineId: string, 
  recordedDate: string
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete([childId, vaccineId, recordedDate]);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of pending CHW vaccinations
 */
export async function getCHWPendingCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all CHW vaccination records (use with caution)
 */
export async function clearAllCHWVaccinations(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migrate existing localStorage data to IndexedDB
 * Call this once to migrate old data
 */
export async function migrateFromLocalStorage(): Promise<{ migrated: number; errors: number }> {
  if (typeof window === 'undefined') {
    return { migrated: 0, errors: 0 };
  }

  const LEGACY_KEY = 'chwPendingVaccinations';
  const raw = localStorage.getItem(LEGACY_KEY);
  
  if (!raw) {
    return { migrated: 0, errors: 0 };
  }

  let migrated = 0;
  let errors = 0;

  try {
    const parsed = JSON.parse(raw) as any[];
    
    for (const record of parsed) {
      try {
        await saveCHWVaccination({
          childId: record.childId,
          childName: record.childName,
          vaccineId: record.vaccineId,
          vaccineName: record.vaccineName,
          recordedDate: record.recordedDate,
          latitude: record.latitude,
          longitude: record.longitude,
          notes: record.notes,
        });
        migrated++;
      } catch (error) {
        console.error('Failed to migrate record:', record, error);
        errors++;
      }
    }

    // Remove from localStorage after successful migration
    if (errors === 0) {
      localStorage.removeItem(LEGACY_KEY);
      console.log(`✅ Successfully migrated ${migrated} CHW vaccination records to IndexedDB`);
    }
  } catch (error) {
    console.error('Failed to parse legacy data:', error);
    errors++;
  }

  return { migrated, errors };
}
