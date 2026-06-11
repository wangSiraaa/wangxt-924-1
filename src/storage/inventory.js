import { getFromStorage, setToStorage, StorageKeys, todayKey } from './storage.js'
import { getMaterials, getMenuItems, getOnSaleMenuItems, getMaterialById, getMenuItemById } from './seedData.js'

export function getInventory(storeId, date = todayKey()) {
  const key = StorageKeys.INVENTORY + storeId + '_' + date
  const inv = getFromStorage(key, {})
  const materials = getMaterials()
  const result = {}
  for (const m of materials) {
    result[m.id] = inv[m.id] != null ? inv[m.id] : null
  }
  return result
}

export function saveInventory(storeId, inventory, date = todayKey()) {
  if (isDailyClosed(storeId, date)) {
    return { success: false, reason: 'closed' }
  }
  const key = StorageKeys.INVENTORY + storeId + '_' + date
  setToStorage(key, inventory)
  return { success: true }
}

export function getSalesForecast(storeId, date = todayKey()) {
  const key = StorageKeys.SALES_FORECAST + storeId + '_' + date
  const fc = getFromStorage(key, {})
  const items = getMenuItems()
  const result = {}
  for (const it of items) {
    result[it.id] = fc[it.id] != null ? fc[it.id] : 0
  }
  return result
}

export function saveSalesForecast(storeId, forecast, date = todayKey()) {
  if (isDailyClosed(storeId, date)) {
    return { success: false, reason: 'closed' }
  }
  const key = StorageKeys.SALES_FORECAST + storeId + '_' + date
  setToStorage(key, forecast)
  return { success: true }
}

export function getSafetyStock(storeId, date = todayKey()) {
  const key = StorageKeys.SAFETY_STOCK + storeId + '_' + date
  const ss = getFromStorage(key, {})
  const materials = getMaterials()
  const result = {}
  for (const m of materials) {
    result[m.id] = ss[m.id] != null ? ss[m.id] : 0
  }
  return result
}

export function saveSafetyStock(storeId, safetyStock, date = todayKey()) {
  if (isDailyClosed(storeId, date)) {
    return { success: false, reason: 'closed' }
  }
  const key = StorageKeys.SAFETY_STOCK + storeId + '_' + date
  setToStorage(key, safetyStock)
  return { success: true }
}

export function getLossReports(storeId, date = todayKey()) {
  const key = StorageKeys.LOSS_REPORTS + storeId + '_' + date
  return getFromStorage(key, [])
}

export function saveLossReports(storeId, reports, date = todayKey()) {
  if (isDailyClosed(storeId, date)) {
    return { success: false, reason: 'closed' }
  }
  const key = StorageKeys.LOSS_REPORTS + storeId + '_' + date
  setToStorage(key, reports)
  return { success: true }
}

export function getCorrections(storeId, date = todayKey()) {
  const key = StorageKeys.CORRECTIONS + storeId + '_' + date
  return getFromStorage(key, [])
}

export function addCorrection(storeId, correction, date = todayKey()) {
  const key = StorageKeys.CORRECTIONS + storeId + '_' + date
  const list = getFromStorage(key, [])
  correction.id = 'C' + Date.now()
  correction.timestamp = new Date().toISOString()
  list.push(correction)
  setToStorage(key, list)
  const invKey = StorageKeys.INVENTORY + storeId + '_' + date
  const inv = getFromStorage(invKey, {})
  inv[correction.materialId] = correction.newQty
  setToStorage(invKey, inv)
  return { success: true, correction }
}

export function getInventoryCheck(storeId, date = todayKey()) {
  const key = StorageKeys.INVENTORY_CHECK + storeId + '_' + date
  return getFromStorage(key, null)
}

export function saveInventoryCheck(storeId, data, date = todayKey()) {
  if (isDailyClosed(storeId, date)) {
    return { success: false, reason: 'closed' }
  }
  const key = StorageKeys.INVENTORY_CHECK + storeId + '_' + date
  setToStorage(key, data)
  return { success: true }
}

export function isInventoryCheckCompleted(storeId, date = todayKey()) {
  const check = getInventoryCheck(storeId, date)
  return Boolean(check && check.completed === true)
}

export function getDailyClosing(storeId, date = todayKey()) {
  const key = StorageKeys.DAILY_CLOSING + storeId + '_' + date
  return getFromStorage(key, null)
}

export function isDailyClosed(storeId, date = todayKey()) {
  const closing = getDailyClosing(storeId, date)
  return Boolean(closing && closing.status === 'closed')
}

export function validateDailyClosing(storeId, date = todayKey()) {
  const errors = []

  if (!isInventoryCheckCompleted(storeId, date)) {
    errors.push({ type: 'inventory_check', message: '盘点未完成，无法提交日结' })
  }

  const inventory = getInventory(storeId, date)
  for (const mid in inventory) {
    if (inventory[mid] != null && inventory[mid] < 0) {
      const mat = getMaterialById(mid)
      errors.push({ type: 'negative_inventory', message: `库存出现负数：${mat?.name || mid} (${inventory[mid]})` })
    }
  }

  const losses = getLossReports(storeId, date)
  const unhandled = losses.filter(l => l.status !== 'processed')
  if (unhandled.length > 0) {
    errors.push({ type: 'unhandled_loss', message: `存在 ${unhandled.length} 条未处理的报损记录` })
  }

  return { valid: errors.length === 0, errors }
}

export function submitDailyClosing(storeId, date = todayKey()) {
  const validation = validateDailyClosing(storeId, date)
  if (!validation.valid) {
    return { success: false, errors: validation.errors }
  }
  const key = StorageKeys.DAILY_CLOSING + storeId + '_' + date
  setToStorage(key, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    storeId,
    date
  })
  return { success: true }
}

export function computeMaterialDemand(storeId, date = todayKey()) {
  const forecast = getSalesForecast(storeId, date)
  const menuItems = getOnSaleMenuItems()
  const demand = {}

  for (const item of menuItems) {
    const qty = forecast[item.id] || 0
    if (qty <= 0) continue
    for (const r of item.recipe) {
      if (!demand[r.materialId]) demand[r.materialId] = 0
      demand[r.materialId] += r.qty * qty
    }
  }
  return demand
}

export function generatePrepTasks(storeId, date = todayKey()) {
  const demand = computeMaterialDemand(storeId, date)
  const inventory = getInventory(storeId, date)
  const safetyStock = getSafetyStock(storeId, date)
  const tasks = []

  const menuItems = getOnSaleMenuItems()

  for (const materialId in demand) {
    const mat = getMaterialById(materialId)
    if (!mat) continue

    const stock = inventory[materialId] != null ? inventory[materialId] : 0
    const safety = safetyStock[materialId] || 0
    const need = demand[materialId]
    const required = Math.max(need, safety)
    const shortage = required - stock

    if (shortage > 0) {
      const affectedItems = menuItems.filter(mi =>
        mi.recipe.some(r => r.materialId === materialId)
      ).map(mi => ({ id: mi.id, name: mi.name }))

      const alternatives = (mat.alternatives || []).map(a => {
        const altMat = getMaterialById(a.id)
        const altStock = inventory[a.id] != null ? inventory[a.id] : 0
        return {
          id: a.id,
          name: altMat?.name || a.name,
          ratio: a.ratio,
          available: altStock,
          unit: altMat?.unit || ''
        }
      })

      tasks.push({
        materialId,
        materialName: mat.name,
        unit: mat.unit,
        category: mat.category,
        currentStock: stock,
        safetyStock: safety,
        demandedQty: need,
        shortageQty: Number(shortage.toFixed(3)),
        requiredQty: Number(required.toFixed(3)),
        belowSafety: stock < safety,
        affectedMenuItems: affectedItems,
        alternatives
      })
    }
  }

  const key = StorageKeys.PREP_TASKS + storeId + '_' + date
  setToStorage(key, tasks)
  return tasks
}

export function getPrepTasks(storeId, date = todayKey()) {
  const key = StorageKeys.PREP_TASKS + storeId + '_' + date
  return getFromStorage(key, [])
}

export function getAvailableMenuItems(storeId, date = todayKey()) {
  const inventory = getInventory(storeId, date)
  const safetyStock = getSafetyStock(storeId, date)
  const items = getMenuItems()

  return items.map(item => {
    let shortageMaterials = []
    let status = 'available'

    if (item.status === 'discontinued') {
      status = 'discontinued'
    } else {
      for (const r of item.recipe) {
        const stock = inventory[r.materialId] != null ? inventory[r.materialId] : 0
        const safety = safetyStock[r.materialId] || 0
        const mat = getMaterialById(r.materialId)
        if (stock < safety) {
          shortageMaterials.push({
            materialId: r.materialId,
            name: mat?.name || r.materialId,
            stock,
            safetyStock: safety
          })
        }
        if (stock <= 0) {
          status = 'unavailable'
        } else if (stock < safety && status !== 'unavailable') {
          status = 'warning'
        }
      }
    }

    return {
      ...item,
      saleStatus: status,
      shortageMaterials
    }
  })
}

export function getStoreSummary(storeId, date = todayKey()) {
  const inventory = getInventory(storeId, date)
  const safetyStock = getSafetyStock(storeId, date)
  const tasks = generatePrepTasks(storeId, date)
  const closed = isDailyClosed(storeId, date)
  const checkCompleted = isInventoryCheckCompleted(storeId, date)
  const losses = getLossReports(storeId, date)

  const belowSafety = tasks.filter(t => t.belowSafety).length
  const negativeCount = Object.values(inventory).filter(v => v != null && v < 0).length
  const unhandledLosses = losses.filter(l => l.status !== 'processed').length

  let riskLevel = 'low'
  if (belowSafety > 3 || negativeCount > 0 || unhandledLosses > 0 || !checkCompleted) {
    riskLevel = 'high'
  } else if (belowSafety > 0) {
    riskLevel = 'medium'
  }

  return {
    storeId,
    riskLevel,
    belowSafetyCount: belowSafety,
    negativeInventory: negativeCount,
    unhandledLosses,
    inventoryCheckCompleted: checkCompleted,
    dailyClosed: closed,
    prepTaskCount: tasks.length,
    outOfStockCount: tasks.filter(t => t.currentStock <= 0).length
  }
}
