import '../src/storage/localStorageMock.js'
import { clearToday } from '../src/storage/storage.js'
import { initSeedData, getStores, getMenuItems, getMaterials, getOnSaleMenuItems } from '../src/storage/seedData.js'
import {
  saveInventory, saveSalesForecast, saveSafetyStock,
  saveLossReports, saveInventoryCheck,
  validateDailyClosing, submitDailyClosing,
  generatePrepTasks, computeMaterialDemand,
  isDailyClosed
} from '../src/storage/inventory.js'

let passed = 0
let failed = 0
const results = []

function test(name, fn) {
  try {
    fn()
    passed++
    results.push({ name, status: 'PASS' })
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    results.push({ name, status: 'FAIL', error: e.message })
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed')
}

function assertEq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

console.log('\n=== 茶饮备料看板 Smoke 测试 ===\n')

initSeedData()
const stores = getStores()
const TEST_STORE = stores[0].id

console.log('1. 盘点未完成 → 日结失败')
test('未完成盘点时校验应返回 inventory_check 错误', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  const inv = {}
  materials.forEach(m => { inv[m.id] = 10 })
  saveInventory(TEST_STORE, inv)
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '校验应失败')
  assert(v.errors.some(e => e.type === 'inventory_check'), '应包含 inventory_check 错误')
})

test('未完成盘点时 submitDailyClosing 应失败', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  saveInventory(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 10])))
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))

  assert(isDailyClosed(TEST_STORE) === false, '日结初始状态应为未提交')
  const r = submitDailyClosing(TEST_STORE)
  assert(r.success === false, '提交日结应失败')
  assert(isDailyClosed(TEST_STORE) === false, '日结状态应为未提交')
})

test('完成盘点后日结校验通过', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  saveInventory(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 10])))
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))
  saveInventoryCheck(TEST_STORE, { completed: true })

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === true, `校验应通过，错误: ${JSON.stringify(v.errors)}`)
})

console.log('\n2. 已停菜单品 → 不生成备料任务')
test('getOnSaleMenuItems 不包含停售品', () => {
  const items = getOnSaleMenuItems()
  const discontinued = items.filter(i => i.status === 'discontinued')
  assertEq(discontinued.length, 0, '在售列表中不应有停售品')
})

test('停售品不纳入原料需求计算', () => {
  clearToday(TEST_STORE)
  const allItems = getMenuItems()
  const discontinuedItem = allItems.find(i => i.status === 'discontinued')
  assert(discontinuedItem, '应存在至少一个停售品')

  const forecast = {}
  allItems.forEach(i => { forecast[i.id] = 100 })
  saveSalesForecast(TEST_STORE, forecast)

  const demand = computeMaterialDemand(TEST_STORE)

  const onSaleItems = allItems.filter(i => i.status === 'on_sale')

  for (const r of discontinuedItem.recipe) {
    const totalExpected = onSaleItems.reduce((sum, item) => {
      const match = item.recipe.find(rr => rr.materialId === r.materialId)
      return sum + (match ? match.qty * 100 : 0)
    }, 0)
    const actual = demand[r.materialId] || 0
    assert(
      Math.abs(actual - totalExpected) < 0.001,
      `原料 ${r.materialId} 需求应仅来自在售品，期望 ${totalExpected}，实际 ${actual}`
    )
  }
})

test('停售品原料不触发备料任务（仅停售品配方需该原料时）', () => {
  clearToday(TEST_STORE)
  const allItems = getMenuItems()
  const discontinuedItem = allItems.find(i => i.status === 'discontinued')

  const discontinuedOnlyMaterials = discontinuedItem.recipe.filter(r =>
    !allItems.some(i => i.status === 'on_sale' && i.recipe.some(rr => rr.materialId === r.materialId))
  )

  if (discontinuedOnlyMaterials.length > 0) {
    const forecast = {}
    allItems.forEach(i => { forecast[i.id] = 100 })
    saveSalesForecast(TEST_STORE, forecast)

    const inv = {}
    getMaterials().forEach(m => { inv[m.id] = 0 })
    saveInventory(TEST_STORE, inv)
    saveSafetyStock(TEST_STORE, Object.fromEntries(getMaterials().map(m => [m.id, 0])))

    const tasks = generatePrepTasks(TEST_STORE)
    const taskMatIds = tasks.map(t => t.materialId)

    for (const dm of discontinuedOnlyMaterials) {
      assert(
        !taskMatIds.includes(dm.materialId),
        `仅停售品使用的原料 ${dm.materialId} 不应出现在备料任务中`
      )
    }
  } else {
    console.log('    (跳过：不存在仅停售品使用的原料)')
  }
})

console.log('\n3. 负库存 → 日结拦截')
test('库存出现负数时校验应返回 negative_inventory 错误', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  const inv = {}
  materials.forEach((m, i) => { inv[m.id] = i === 0 ? -1 : 10 })
  saveInventory(TEST_STORE, inv)
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))
  saveInventoryCheck(TEST_STORE, { completed: true })

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '校验应失败')
  assert(v.errors.some(e => e.type === 'negative_inventory'), '应包含 negative_inventory 错误')
})

test('存在负库存时 submitDailyClosing 应失败且不锁定', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  const inv = {}
  materials.forEach((m, i) => { inv[m.id] = i === 1 ? -5 : 10 })
  saveInventory(TEST_STORE, inv)
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))
  saveInventoryCheck(TEST_STORE, { completed: true })

  const r = submitDailyClosing(TEST_STORE)
  assert(r.success === false, '提交应失败')
  assert(isDailyClosed(TEST_STORE) === false, '日结不应被标记为已提交')
})

test('修正负库存后可通过校验', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  const inv = {}
  materials.forEach(m => { inv[m.id] = 10 })
  saveInventory(TEST_STORE, inv)
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))
  saveInventoryCheck(TEST_STORE, { completed: true })

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === true, `修正负库存后应通过，错误: ${JSON.stringify(v.errors)}`)
})

console.log('\n4. 未处理报损 → 日结拦截（附加验证）')
test('存在未处理报损时校验失败', () => {
  clearToday(TEST_STORE)
  const materials = getMaterials()
  saveInventory(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 10])))
  saveSafetyStock(TEST_STORE, Object.fromEntries(materials.map(m => [m.id, 5])))
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L1', materialId: materials[0].id, qty: 1, reason: 'test', status: 'pending' }
  ])

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '存在未处理报损应失败')
  assert(v.errors.some(e => e.type === 'unhandled_loss'), '应包含 unhandled_loss 错误')
})

console.log('\n=== 测试结果 ===')
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)

if (failed > 0) {
  console.log('\n失败详情:')
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`)
  })
  process.exit(1)
} else {
  console.log('\n✅ 全部通过！')
  process.exit(0)
}
