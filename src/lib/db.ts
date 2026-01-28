
const DB_NAME = 'ExcelTemplateToolDB';
const STORE_NAME = 'templates';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event);
            reject('Error opening database');
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveTemplate = async (file: File): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // We only store one template for now with id 'default'
        const request = store.put({ id: 'default', file, name: file.name, type: file.type, lastModified: file.lastModified });

        request.onerror = () => reject('Error saving template');
        request.onsuccess = () => resolve();
    });
};

export const getTemplate = async (): Promise<File | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('default');

        request.onerror = () => reject('Error fetching template');
        request.onsuccess = () => {
            const result = request.result;
            if (result && result.file) {
                // Reconstruct file if needed, but IDB usually stores the Blob/File correctly
                resolve(result.file);
            } else {
                resolve(null);
            }
        };
    });
};

export const deleteTemplate = async (): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete('default');

        request.onerror = () => reject('Error deleting template');
        request.onsuccess = () => resolve();
    });
};
