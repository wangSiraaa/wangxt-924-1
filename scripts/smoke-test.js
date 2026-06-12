import '../src/storage/localStorageMock.js'
import { clearToday } from '../src/storage/storage.js'
import { initSeedData, getStores, getMenuItems, getMaterials, getOnSaleMenuItems } from '../src/storage/seedData.js'
import {
  saveInventory, saveSalesForecast, saveSafetyStock,
  saveLossReports, saveInventoryCheck,
  validateDailyClosing, submitDailyClosing,
  generatePrepTasks, computeMaterialDemand,
  isDailyClosed,
  getInventory, getInTransit,
  createTransferRequest, approveTransfer, rejectTransfer,
  confirmInTransit, getTransfers,
  submitLossForApproval, approveLoss, rejectLoss,
  addCorrection, addCorrectionForTransfer,
  getSameRegionStores
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

function setupStore(storeId, invValues, safetyValues) {
  clearToday(storeId)
  const materials = getMaterials()
  const inv = invValues || {}
  materials.forEach(m => { inv[m.id] = inv[m.id] != null ? inv[m.id] : 10 })
  saveInventory(storeId, inv)
  saveSafetyStock(storeId, safetyValues || Object.fromEntries(materials.map(m => [m.id, 5])))
}

console.log('\n=== 茶饮备料看板 Smoke 测试 ===\n')

initSeedData()
const stores = getStores()
const TEST_STORE = stores[0].id
const TEST_STORE_2 = stores[1].id

console.log('1. 盘点未完成 → 日结失败')
test('未完成盘点时校验应返回 inventory_check 错误', () => {
  setupStore(TEST_STORE)
  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '校验应失败')
  assert(v.errors.some(e => e.type === 'inventory_check'), '应包含 inventory_check 错误')
})

test('未完成盘点时 submitDailyClosing 应失败', () => {
  setupStore(TEST_STORE)
  assert(isDailyClosed(TEST_STORE) === false, '日结初始状态应为未提交')
  const r = submitDailyClosing(TEST_STORE)
  assert(r.success === false, '提交日结应失败')
  assert(isDailyClosed(TEST_STORE) === false, '日结状态应为未提交')
})

test('完成盘点后日结校验通过', () => {
  setupStore(TEST_STORE)
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
  const materials = getMaterials()
  const inv = {}
  materials.forEach((m, i) => { inv[m.id] = i === 0 ? -1 : 10 })
  setupStore(TEST_STORE, inv)
  saveInventoryCheck(TEST_STORE, { completed: true })

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '校验应失败')
  assert(v.errors.some(e => e.type === 'negative_inventory'), '应包含 negative_inventory 错误')
})

test('存在负库存时 submitDailyClosing 应失败且不锁定', () => {
  const materials = getMaterials()
  const inv = {}
  materials.forEach((m, i) => { inv[m.id] = i === 1 ? -5 : 10 })
  setupStore(TEST_STORE, inv)
  saveInventoryCheck(TEST_STORE, { completed: true })

  const r = submitDailyClosing(TEST_STORE)
  assert(r.success === false, '提交应失败')
  assert(isDailyClosed(TEST_STORE) === false, '日结不应被标记为已提交')
})

test('修正负库存后可通过校验', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === true, `修正负库存后应通过，错误: ${JSON.stringify(v.errors)}`)
})

console.log('\n4. 未处理报损 → 日结拦截')
test('存在未处理报损时校验失败', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L1', materialId: getMaterials()[0].id, qty: 1, reason: 'test', status: 'pending' }
  ])

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '存在未处理报损应失败')
  assert(v.errors.some(e => e.type === 'unhandled_loss'), '应包含 unhandled_loss 错误')
})

console.log('\n5. 跨店调拨 → 审批与扣减')
test('创建同区域调拨申请成功', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })

  const result = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  assert(result.success === true, `调拨申请应成功，但返回: ${JSON.stringify(result)}`)
  assert(result.transfer.status === 'pending', '状态应为 pending')
  assert(result.transfer.fromStoreId === TEST_STORE, '调出店应正确')
  assert(result.transfer.toStoreId === TEST_STORE_2, '调入店应正确')
})

test('不能向不同区域门店调拨', () => {
  const materials = getMaterials()
  const differentRegionStore = stores.find(s => s.region !== stores[0].region)
  if (differentRegionStore) {
    setupStore(TEST_STORE, { [materials[0].id]: 100 })
    setupStore(differentRegionStore.id, { [materials[0].id]: 2 })
    const result = createTransferRequest(TEST_STORE, differentRegionStore.id, materials[0].id, 5)
    assert(result.success === false, '跨区域调拨应失败')
    assert(result.reason === 'different_region', '原因应为 different_region')
  } else {
    console.log('    (跳过：无不同区域门店)')
  }
})

test('库存不足时调拨申请失败', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 3 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })

  const result = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 10)
  assert(result.success === false, '库存不足时调拨应失败')
  assert(result.reason === 'insufficient_stock', '原因应为 insufficient_stock')
})

test('审批通过后调出店库存扣减、调入店在途增加', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  assert(createResult.success === true, '调拨申请应成功')

  const approveResult = approveTransfer(createResult.transfer.id, '同意调拨')
  assert(approveResult.success === true, `审批应成功: ${JSON.stringify(approveResult)}`)

  const fromInv = getInventory(TEST_STORE)
  assertEq(fromInv[materials[0].id], 95, '调出店库存应减5')

  const toTransit = getInTransit(TEST_STORE_2)
  assertEq(toTransit[materials[0].id], 5, '调入店在途量应为5')
})

test('确认在途后库存增加、在途量清零', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  approveTransfer(createResult.transfer.id, '同意')

  const confirmResult = confirmInTransit(TEST_STORE_2, materials[0].id)
  assert(confirmResult.success === true, '确认收货应成功')
  assertEq(confirmResult.receivedQty, 5, '收到数量应为5')

  const toInv = getInventory(TEST_STORE_2)
  assertEq(toInv[materials[0].id], 7, '调入店库存应为2+5=7')

  const toTransit = getInTransit(TEST_STORE_2)
  assertEq(toTransit[materials[0].id], 0, '调入店在途量应清零')
})

test('驳回调拨不扣减库存', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  const rejectResult = rejectTransfer(createResult.transfer.id, '拒绝')
  assert(rejectResult.success === true, '驳回应成功')

  const fromInv = getInventory(TEST_STORE)
  assertEq(fromInv[materials[0].id], 100, '驳回后调出店库存不变')
})

test('已停菜单品标记 isDiscontinuedOnly', () => {
  const allItems = getMenuItems()
  const discontinuedItem = allItems.find(i => i.status === 'discontinued')
  const discontinuedOnlyMat = discontinuedItem.recipe.find(r =>
    !allItems.some(i => i.status === 'on_sale' && i.recipe.some(rr => rr.materialId === r.materialId))
  )

  if (discontinuedOnlyMat) {
    const materials = getMaterials()
    setupStore(TEST_STORE, { [discontinuedOnlyMat.materialId]: 100 })
    setupStore(TEST_STORE_2, { [discontinuedOnlyMat.materialId]: 2 })

    const result = createTransferRequest(TEST_STORE, TEST_STORE_2, discontinuedOnlyMat.materialId, 3)
    assert(result.success === true, '调拨仅停售品用原料应成功')
    assert(result.transfer.isDiscontinuedOnly === true, '应标记 isDiscontinuedOnly')
  } else {
    console.log('    (跳过：无仅停售品使用的原料)')
  }
})

console.log('\n6. 在途未确认 → 日结拦截')
test('存在在途未确认原料时校验返回 unconfirmed_in_transit 错误', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })
  saveInventoryCheck(TEST_STORE_2, { completed: true })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  approveTransfer(createResult.transfer.id, '同意')

  const v = validateDailyClosing(TEST_STORE_2)
  assert(v.valid === false, '存在在途未确认应校验失败')
  assert(v.errors.some(e => e.type === 'unconfirmed_in_transit'), '应包含 unconfirmed_in_transit 错误')
})

test('确认在途后日结校验通过', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })
  saveInventoryCheck(TEST_STORE_2, { completed: true })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  approveTransfer(createResult.transfer.id, '同意')
  confirmInTransit(TEST_STORE_2, materials[0].id)

  const v = validateDailyClosing(TEST_STORE_2)
  assert(v.valid === true, `确认在途后应通过校验，错误: ${JSON.stringify(v.errors)}`)
})

console.log('\n7. 报损审批 → 阻断日结')
test('待审批报损阻止日结', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L1', materialId: getMaterials()[0].id, qty: 1, reason: '过期', status: 'pending_approval' }
  ])

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '待审批报损应校验失败')
  assert(v.errors.some(e => e.type === 'pending_approval_loss'), '应包含 pending_approval_loss 错误')
})

test('督导审批报损后状态变为 processed', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L2', materialId: getMaterials()[0].id, qty: 1, reason: '破损', status: 'pending_approval' }
  ])

  const result = approveLoss(TEST_STORE, 'L2')
  assert(result.success === true, '审批报损应成功')

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === true, `审批后应通过校验，错误: ${JSON.stringify(v.errors)}`)
})

test('驳回报损后状态变为 rejected', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L3', materialId: getMaterials()[0].id, qty: 1, reason: '误报', status: 'pending_approval' }
  ])

  const result = rejectLoss(TEST_STORE, 'L3')
  assert(result.success === true, '驳回报损应成功')

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === true, `驳回后应通过校验，错误: ${JSON.stringify(v.errors)}`)
})

test('吧员提交报损审批流程', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveLossReports(TEST_STORE, [
    { id: 'L4', materialId: getMaterials()[0].id, qty: 2, reason: '称重差异', status: 'pending' }
  ])

  const submitResult = submitLossForApproval(TEST_STORE, 'L4')
  assert(submitResult.success === true, '提交审批应成功')

  const v = validateDailyClosing(TEST_STORE)
  assert(v.valid === false, '提交审批后（待审批状态）应阻止日结')
  assert(v.errors.some(e => e.type === 'pending_approval_loss'), '应包含 pending_approval_loss 错误')

  approveLoss(TEST_STORE, 'L4')
  const v2 = validateDailyClosing(TEST_STORE)
  assert(v2.valid === true, '督导审批后应通过校验')
})

console.log('\n8. 日结后禁止直接改库存')
test('日结后 saveInventory 返回失败', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })

  const closeResult = submitDailyClosing(TEST_STORE)
  assert(closeResult.success === true, '日结应成功')

  const saveResult = saveInventory(TEST_STORE, { M001: 999 })
  assert(saveResult.success === false, '日结后应无法直接保存库存')
  assert(saveResult.reason === 'closed', '原因应为 closed')

  const inv = getInventory(TEST_STORE)
  assert(inv.M001 !== 999, '库存不应被修改')
})

test('日结后只能通过更正记录调整', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  submitDailyClosing(TEST_STORE)

  const corrResult = addCorrection(TEST_STORE, {
    materialId: getMaterials()[0].id,
    materialName: getMaterials()[0].name,
    newQty: 20,
    reason: '盘点更正'
  })
  assert(corrResult.success === true, '更正记录应成功')

  const inv = getInventory(TEST_STORE)
  assertEq(inv[getMaterials()[0].id], 20, '更正后库存应为20')
})

test('日结后调拨申请失败', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  saveInventoryCheck(TEST_STORE, { completed: true })
  submitDailyClosing(TEST_STORE)

  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })
  const result = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  assert(result.success === false, '日结后调拨申请应失败')
  assert(result.reason === 'closed', '原因应为 closed')
})

test('日结后报损提交审批失败', () => {
  setupStore(TEST_STORE)
  saveInventoryCheck(TEST_STORE, { completed: true })
  submitDailyClosing(TEST_STORE)

  const materials = getMaterials()
  const saveResult = saveLossReports(TEST_STORE, [
    { id: 'L5', materialId: materials[0].id, qty: 1, reason: 'test', status: 'pending' }
  ])
  assert(saveResult.success === false, '日结后应无法保存报损记录')
  assert(saveResult.reason === 'closed', '原因应为 closed')
})

console.log('\n9. 调拨更正记录（日结后）')
test('日结后可通过更正记录调整调拨数据', () => {
  const materials = getMaterials()
  setupStore(TEST_STORE, { [materials[0].id]: 100 })
  setupStore(TEST_STORE_2, { [materials[0].id]: 2 })
  saveInventoryCheck(TEST_STORE, { completed: true })
  saveInventoryCheck(TEST_STORE_2, { completed: true })

  const createResult = createTransferRequest(TEST_STORE, TEST_STORE_2, materials[0].id, 5)
  approveTransfer(createResult.transfer.id, '同意')
  confirmInTransit(TEST_STORE_2, materials[0].id)
  submitDailyClosing(TEST_STORE_2)

  const corrResult = addCorrectionForTransfer(TEST_STORE_2, createResult.transfer.id, '调拨数量有误')
  assert(corrResult.success === true, '调拨更正应成功')
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
