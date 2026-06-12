import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStores, getMaterials, getMenuItems, getMaterialById, getMenuItemById } from '../storage/seedData.js'
import { getFromStorage, setToStorage, StorageKeys } from '../storage/storage.js'
import {
  getInventory, saveInventory,
  getSalesForecast, saveSalesForecast,
  getSafetyStock, saveSafetyStock,
  getLossReports, saveLossReports,
  getCorrections, addCorrection,
  getInventoryCheck, saveInventoryCheck,
  isInventoryCheckCompleted,
  isDailyClosed, getDailyClosing,
  validateDailyClosing, submitDailyClosing,
  generatePrepTasks, getPrepTasks,
  getTransfers, createTransferRequest,
  getInTransit, submitLossForApproval,
  getSameRegionStores
} from '../storage/inventory.js'

export default function ManagerPage() {
  const stores = getStores()
  const [currentStore, setCurrentStore] = useState(
    () => getFromStorage(StorageKeys.CURRENT_STORE, stores[0]?.id || '')
  )
  const [activeTab, setActiveTab] = useState('inventory')
  const [inventory, setInventory] = useState({})
  const [salesForecast, setSalesForecast] = useState({})
  const [safetyStock, setSafetyStock] = useState({})
  const [lossReports, setLossReports] = useState([])
  const [corrections, setCorrections] = useState([])
  const [inventoryCheck, setInventoryCheck] = useState(null)
  const [closing, setClosing] = useState(null)
  const [validateErrors, setValidateErrors] = useState([])
  const [validateSuccess, setValidateSuccess] = useState(false)
  const [newLoss, setNewLoss] = useState({ materialId: '', qty: 0, reason: '', status: 'pending' })
  const [newCorrection, setNewCorrection] = useState({ materialId: '', newQty: 0, reason: '' })
  const [transfers, setTransfers] = useState([])
  const [inTransit, setInTransit] = useState({})
  const [newTransfer, setNewTransfer] = useState({ toStoreId: '', materialId: '', qty: 0 })

  const closed = isDailyClosed(currentStore)

  useEffect(() => {
    setToStorage(StorageKeys.CURRENT_STORE, currentStore)
    refreshData()
  }, [currentStore, activeTab])

  function refreshData() {
    setInventory(getInventory(currentStore))
    setSalesForecast(getSalesForecast(currentStore))
    setSafetyStock(getSafetyStock(currentStore))
    setLossReports(getLossReports(currentStore))
    setCorrections(getCorrections(currentStore))
    setInventoryCheck(getInventoryCheck(currentStore))
    setClosing(getDailyClosing(currentStore))
    setTransfers(getTransfers(currentStore))
    setInTransit(getInTransit(currentStore))
    setValidateErrors([])
    setValidateSuccess(false)
  }

  function handleInvChange(mid, value) {
    const v = value === '' ? null : Number(value)
    setInventory(prev => ({ ...prev, [mid]: v }))
  }

  function handleForecastChange(did, value) {
    setSalesForecast(prev => ({ ...prev, [did]: Number(value) || 0 }))
  }

  function handleSafetyChange(mid, value) {
    setSafetyStock(prev => ({ ...prev, [mid]: Number(value) || 0 }))
  }

  function saveAll() {
    saveInventory(currentStore, inventory)
    saveSalesForecast(currentStore, salesForecast)
    saveSafetyStock(currentStore, safetyStock)
    generatePrepTasks(currentStore)
    alert('保存成功')
    refreshData()
  }

  function handleAddLoss() {
    if (!newLoss.materialId || newLoss.qty <= 0) return
    const report = {
      ...newLoss,
      id: 'L' + Date.now(),
      createdAt: new Date().toISOString(),
      materialName: getMaterialById(newLoss.materialId)?.name || ''
    }
    const list = [...lossReports, report]
    saveLossReports(currentStore, list)
    setLossReports(list)
    setNewLoss({ materialId: '', qty: 0, reason: '', status: 'pending' })
  }

  function handleSubmitLossForApproval(lid) {
    const result = submitLossForApproval(currentStore, lid)
    if (result.success) {
      refreshData()
    } else {
      alert('提交审批失败：' + result.reason)
    }
  }

  function handleProcessLoss(lid) {
    const list = lossReports.map(l =>
      l.id === lid ? { ...l, status: 'processed', processedAt: new Date().toISOString() } : l
    )
    saveLossReports(currentStore, list)
    setLossReports(list)
  }

  function handleAddCorrection() {
    if (!newCorrection.materialId) return
    addCorrection(currentStore, {
      materialId: newCorrection.materialId,
      materialName: getMaterialById(newCorrection.materialId)?.name || '',
      newQty: Number(newCorrection.newQty) || 0,
      reason: newCorrection.reason
    })
    setNewCorrection({ materialId: '', newQty: 0, reason: '' })
    refreshData()
  }

  function handleInventoryCheckToggle() {
    const current = inventoryCheck || { completed: false }
    const next = { ...current, completed: !current.completed, updatedAt: new Date().toISOString() }
    saveInventoryCheck(currentStore, next)
    setInventoryCheck(next)
  }

  function handleSubmitClosing() {
    const v = validateDailyClosing(currentStore)
    if (!v.valid) {
      setValidateErrors(v.errors)
      setValidateSuccess(false)
      return
    }
    const result = submitDailyClosing(currentStore)
    if (result.success) {
      setValidateErrors([])
      setValidateSuccess(true)
      refreshData()
    }
  }

  function handleCreateTransfer() {
    if (!newTransfer.toStoreId || !newTransfer.materialId || newTransfer.qty <= 0) return
    const result = createTransferRequest(
      currentStore,
      newTransfer.toStoreId,
      newTransfer.materialId,
      Number(newTransfer.qty)
    )
    if (result.success) {
      setNewTransfer({ toStoreId: '', materialId: '', qty: 0 })
      refreshData()
    } else {
      const msgs = {
        closed: '门店已日结',
        different_region: '只能向同区域门店调拨',
        same_store: '不能向本店调拨',
        insufficient_stock: '库存不足'
      }
      alert('调拨申请失败：' + (msgs[result.reason] || result.reason))
    }
  }

  const materials = getMaterials()
  const menuItems = getMenuItems()
  const prepTasks = getPrepTasks(currentStore)
  const sameRegionStores = getSameRegionStores(currentStore)

  const belowSafetyMaterials = materials.filter(m => {
    const stock = inventory[m.id]
    const safety = safetyStock[m.id] || 0
    return stock != null && stock < safety
  })

  return (
    <div className="app-container">
      <Link to="/" className="back-link">← 返回首页</Link>

      <div className="top-bar">
        <h1>📋 店长工作台</h1>
        <div className="store-select">
          <span>门店：</span>
          <select value={currentStore} onChange={e => setCurrentStore(e.target.value)}>
            {stores.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      </div>

      {closed && (
        <div className="closed-banner">
          今日日结已提交于 {closing?.closedAt && new Date(closing.closedAt).toLocaleString('zh-CN')}。
          库存调整请使用「更正记录」功能，不能直接覆盖原数。
        </div>
      )}

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>
          库存录入
        </button>
        <button className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`} onClick={() => setActiveTab('forecast')}>
          销量预估
        </button>
        <button className={`tab-btn ${activeTab === 'safety' ? 'active' : ''}`} onClick={() => setActiveTab('safety')}>
          安全库存
        </button>
        <button className={`tab-btn ${activeTab === 'transfer' ? 'active' : ''}`} onClick={() => setActiveTab('transfer')}>
          跨店调拨
        </button>
        <button className={`tab-btn ${activeTab === 'loss' ? 'active' : ''}`} onClick={() => setActiveTab('loss')}>
          报损记录
        </button>
        <button className={`tab-btn ${activeTab === 'closing' ? 'active' : ''}`} onClick={() => setActiveTab('closing')}>
          盘点与日结
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="panel">
          <h3>原料库存录入
            {closed && <span className="status-tag danger" style={{ marginLeft: 10 }}>已日结，无法直接修改</span>}
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>原料名称</th>
                <th>分类</th>
                <th>单位</th>
                <th>当前库存</th>
                <th>在途量</th>
                <th>安全库存</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => {
                const stock = inventory[m.id]
                const transit = inTransit[m.id] || 0
                const safety = safetyStock[m.id] || 0
                let rowClass = ''
                let cellClass = 'cell-ok'
                let statusText = '正常'
                if (stock == null) {
                  statusText = '未录入'
                } else if (stock < 0) {
                  rowClass = 'row-danger'
                  cellClass = 'cell-danger'
                  statusText = '负数异常'
                } else if (stock < safety) {
                  rowClass = 'row-warning'
                  cellClass = 'cell-warning'
                  statusText = `低于安全库存 ${Number((safety - stock).toFixed(3))}`
                }
                return (
                  <tr key={m.id} className={rowClass}>
                    <td>{m.name}</td>
                    <td>{m.category}</td>
                    <td>{m.unit}</td>
                    <td>
                      <input type="number" step="0.001" className="input-sm"
                             value={stock ?? ''}
                             disabled={closed}
                             onChange={e => handleInvChange(m.id, e.target.value)} />
                    </td>
                    <td>{transit > 0 ? <span className="cell-warning">{transit}</span> : 0}</td>
                    <td>{safety} {m.unit}</td>
                    <td className={cellClass}>{statusText}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={saveAll} disabled={closed}>保存全部</button>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="panel">
          <h3>今日销量预估
            {closed && <span className="status-tag danger" style={{ marginLeft: 10 }}>已日结</span>}
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>单品名称</th>
                <th>状态</th>
                <th>今日预估销量（杯）</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map(item => (
                <tr key={item.id} className={item.status === 'discontinued' ? 'discontinued' : ''}>
                  <td>{item.name}</td>
                  <td>
                    {item.status === 'on_sale'
                      ? <span className="status-tag info">在售</span>
                      : <span className="status-tag danger">已停售</span>}
                  </td>
                  <td>
                    <input type="number" className="input-sm"
                           value={salesForecast[item.id] || 0}
                           disabled={closed || item.status === 'discontinued'}
                           onChange={e => handleForecastChange(item.id, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={saveAll} disabled={closed}>保存并生成备料任务</button>
          </div>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="panel">
          <h3>安全库存设置
            {closed && <span className="status-tag danger" style={{ marginLeft: 10 }}>已日结</span>}
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>原料名称</th>
                <th>分类</th>
                <th>单位</th>
                <th>安全库存</th>
                <th>当前库存</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(m => {
                const stock = inventory[m.id]
                const safety = safetyStock[m.id] || 0
                let cellClass = 'cell-ok'
                let statusText = '正常'
                if (stock == null) {
                  statusText = '未录入库存'
                } else if (stock < safety) {
                  cellClass = 'cell-warning'
                  statusText = '低于安全库存'
                }
                return (
                  <tr key={m.id} className={stock != null && stock < safety ? 'row-warning' : ''}>
                    <td>{m.name}</td>
                    <td>{m.category}</td>
                    <td>{m.unit}</td>
                    <td>
                      <input type="number" step="0.001" className="input-sm"
                             value={safety}
                             disabled={closed}
                             onChange={e => handleSafetyChange(m.id, e.target.value)} />
                    </td>
                    <td>{stock ?? '—'}</td>
                    <td className={cellClass}>{statusText}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={saveAll} disabled={closed}>保存</button>
          </div>
        </div>
      )}

      {activeTab === 'transfer' && (
        <div className="panel">
          <h3>跨店调拨申请</h3>

          {belowSafetyMaterials.length > 0 && !closed && (
            <div style={{ marginBottom: 16, padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
              <strong style={{ color: '#d97706' }}>⚠ 以下原料低于安全库存，可向同区域门店发起调拨：</strong>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {belowSafetyMaterials.map(m => (
                  <span key={m.id} className="alt-tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                    {m.name} (库存{inventory[m.id]}/{safetyStock[m.id] || 0})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <select value={newTransfer.materialId} onChange={e => setNewTransfer({ ...newTransfer, materialId: e.target.value })} disabled={closed}>
              <option value="">选择原料</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={newTransfer.toStoreId} onChange={e => setNewTransfer({ ...newTransfer, toStoreId: e.target.value })} disabled={closed}>
              <option value="">选择调入门店</option>
              {sameRegionStores.map(s => <option key={s.id} value={s.id}>{s.name}（{s.region}）</option>)}
            </select>
            <input type="number" step="0.001" placeholder="调拨数量"
                   value={newTransfer.qty || ''} disabled={closed}
                   onChange={e => setNewTransfer({ ...newTransfer, qty: e.target.value })} />
            <button className="btn btn-primary btn-sm" onClick={handleCreateTransfer} disabled={closed}>发起调拨</button>
          </div>

          {sameRegionStores.length === 0 && (
            <p style={{ color: '#64748b', fontSize: 13 }}>当前门店所在区域无其他门店，无法发起跨店调拨。</p>
          )}

          <h4 style={{ marginTop: 16, marginBottom: 12 }}>调拨记录</h4>
          {transfers.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无调拨记录</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>原料</th>
                  <th>数量</th>
                  <th>调出店</th>
                  <th>调入店</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t.id} className={t.status === 'rejected' ? 'row-danger' : t.status === 'pending' ? 'row-warning' : ''}>
                    <td style={{ fontSize: 12 }}>{new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                      {t.materialName}
                      {t.isDiscontinuedOnly && <span className="status-tag danger" style={{ marginLeft: 6, fontSize: 10 }}>仅停售品用</span>}
                    </td>
                    <td>{t.qty}</td>
                    <td>{t.fromStoreName}</td>
                    <td>{t.toStoreName}</td>
                    <td>
                      {t.status === 'pending' && <span className="status-tag open">待审批</span>}
                      {t.status === 'approved' && <span className="status-tag closed">已审批</span>}
                      {t.status === 'rejected' && <span className="status-tag danger">已驳回</span>}
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{t.supervisorNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 12 }}>在途原料</h4>
            {Object.entries(inTransit).filter(([, v]) => v > 0).length === 0 ? (
              <p style={{ color: '#64748b' }}>暂无在途原料</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>原料</th>
                    <th>在途数量</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(inTransit).filter(([, v]) => v > 0).map(([mid, qty]) => {
                    const mat = getMaterialById(mid)
                    return (
                      <tr key={mid}>
                        <td>{mat?.name || mid}</td>
                        <td className="cell-warning">{qty}</td>
                        <td><span className="status-tag open">待确认收货</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'loss' && (
        <div className="panel">
          <h3>报损记录
            {closed && <span className="status-tag danger" style={{ marginLeft: 10 }}>已日结</span>}
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <select value={newLoss.materialId} onChange={e => setNewLoss({ ...newLoss, materialId: e.target.value })} disabled={closed}>
              <option value="">选择原料</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input type="number" step="0.001" placeholder="报损数量"
                   value={newLoss.qty || ''} disabled={closed}
                   onChange={e => setNewLoss({ ...newLoss, qty: e.target.value })} />
            <input type="text" placeholder="报损原因"
                   value={newLoss.reason} disabled={closed}
                   onChange={e => setNewLoss({ ...newLoss, reason: e.target.value })} />
            <button className="btn btn-primary btn-sm" onClick={handleAddLoss} disabled={closed}>添加报损</button>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            报损添加后为「待提交」状态，需提交审批由督导审核。未处理报损将阻止日结。
          </p>
          {lossReports.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无报损记录</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>原料</th>
                  <th>数量</th>
                  <th>原因</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {lossReports.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{new Date(l.createdAt).toLocaleString('zh-CN')}</td>
                    <td>{l.materialName}</td>
                    <td>{l.qty}</td>
                    <td>{l.reason}</td>
                    <td>
                      {l.status === 'pending' && <span className="status-tag open">待提交审批</span>}
                      {l.status === 'pending_approval' && <span className="status-tag danger">待审批</span>}
                      {l.status === 'processed' && <span className="status-tag closed">已处理{l.approvedBySupervisor ? '（督导审批）' : ''}</span>}
                      {l.status === 'rejected' && <span className="status-tag danger">已驳回</span>}
                    </td>
                    <td>
                      {l.status === 'pending' && !closed && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleSubmitLossForApproval(l.id)}>
                          提交审批
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'closing' && (
        <>
          <div className="panel">
            <h3>盘点管理</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label className="checkbox-wrap">
                <input type="checkbox"
                       checked={isInventoryCheckCompleted(currentStore)}
                       disabled={closed}
                       onChange={handleInventoryCheckToggle} />
                <strong>盘点已完成</strong>
              </label>
              {inventoryCheck?.updatedAt && (
                <span style={{ color: '#64748b', fontSize: 13 }}>
                  更新时间：{new Date(inventoryCheck.updatedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
              盘点完成前将无法提交日结。请确认所有原料库存已准确录入。
            </p>
          </div>

          <div className="panel">
            <h3>更正记录（日结后库存调整唯一通道）</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
              <select value={newCorrection.materialId} onChange={e => setNewCorrection({ ...newCorrection, materialId: e.target.value })}>
                <option value="">选择原料</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="number" step="0.001" placeholder="更正后数量"
                     value={newCorrection.newQty || ''}
                     onChange={e => setNewCorrection({ ...newCorrection, newQty: e.target.value })} />
              <input type="text" placeholder="更正原因"
                     value={newCorrection.reason}
                     onChange={e => setNewCorrection({ ...newCorrection, reason: e.target.value })} />
              <button className="btn btn-primary btn-sm" onClick={handleAddCorrection}>提交更正</button>
            </div>
            {corrections.length === 0 ? (
              <p style={{ color: '#64748b' }}>暂无更正记录</p>
            ) : (
              <div className="correction-list">
                {corrections.slice().reverse().map(c => (
                  <div key={c.id} className="correction-item">
                    <div><strong>{c.materialName}</strong> → 更正为 {c.newQty}
                      <span style={{ color: '#64748b', marginLeft: 10 }}>原因：{c.reason || '—'}</span>
                    </div>
                    <div className="time">{new Date(c.timestamp).toLocaleString('zh-CN')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h3>提交日结</h3>
            {validateSuccess && (
              <div className="success-box">✅ 日结已成功提交！今日库存已锁定，后续调整请使用更正记录。</div>
            )}
            {validateErrors.length > 0 && (
              <div className="error-box">
                <strong>日结校验失败，请处理以下问题：</strong>
                <ul>
                  {validateErrors.map((e, i) => <li key={i}>{e.message}</li>)}
                </ul>
              </div>
            )}
            {closed ? (
              <div>
                <p style={{ color: '#166534' }}>
                  ✅ 今日已于 {new Date(closing.closedAt).toLocaleString('zh-CN')} 完成日结。
                </p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#64748b', marginBottom: 12 }}>
                  提交前将校验：盘点状态、负库存、未处理报损、待审批报损、在途未确认。提交后当天库存锁定。
                </p>
                <button className="btn btn-danger" onClick={handleSubmitClosing}>
                  提交今日日结
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
