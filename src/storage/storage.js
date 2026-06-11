const STORAGE_PREFIX = 'tea_prep_'

export const StorageKeys = {
  STORES: STORAGE_PREFIX + 'stores',
  MATERIALS: STORAGE_PREFIX + 'materials',
  MENU_ITEMS: STORAGE_PREFIX + 'menuItems',
  INVENTORY: STORAGE_PREFIX + 'inventory_',
  SALES_FORECAST: STORAGE_PREFIX + 'salesForecast_',
  SAFETY_STOCK: STORAGE_PREFIX + 'safetyStock_',
  PREP_TASKS: STORAGE_PREFIX + 'prepTasks_',
  LOSS_REPORTS: STORAGE_PREFIX + 'lossReports_',
  CORRECTIONS: STORAGE_PREFIX + 'corrections_',
  DAILY_CLOSING: STORAGE_PREFIX + 'dailyClosing_',
  INVENTORY_CHECK: STORAGE_PREFIX + 'inventoryCheck_',
  ROLE: STORAGE_PREFIX + 'role',
  CURRENT_STORE: STORAGE_PREFIX + 'currentStore'
}

export function getFromStorage(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch (e) {
    console.error('Storage read error:', key, e)
    return defaultValue
  }
}

export function setToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    console.error('Storage write error:', key, e)
    return false
  }
}

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export function clearToday(storeId) {
  const tk = todayKey()
  localStorage.removeItem(StorageKeys.INVENTORY + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.SALES_FORECAST + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.SAFETY_STOCK + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.PREP_TASKS + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.LOSS_REPORTS + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.CORRECTIONS + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.DAILY_CLOSING + storeId + '_' + tk)
  localStorage.removeItem(StorageKeys.INVENTORY_CHECK + storeId + '_' + tk)
}
