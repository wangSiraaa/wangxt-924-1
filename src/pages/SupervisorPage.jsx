import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStores, getMaterials } from '../storage/seedData.js'
import {
  getStoreSummary, generatePrepTasks, getPrepTasks,
  isInventoryCheckCompleted, isDailyClosed,
  getInventory, getLossReports, getSafetyStock,
  getTransfers, approveTransfer, rejectTransfer,
  getAllTransfersForRegion, approveLoss, rejectLoss,
  getInTransit
} from '../storage/inventory.js'

export default function SupervisorPage() {
  const stores = getStores()
  const [summaries, setSummaries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [detailTasks, setDetailTasks] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [pendingTransfers, setPendingTransfers] = useState([])
  const [pendingLosses, setPendingLosses] = useState([])
  const [approvalNote, setApprovalNote] = useState('')

  useEffect(() => {
    loadSummaries()
    loadPendingApprovals()
  }, [])

  function loadSummaries() {
    const list = stores.map(s => getStoreSummary(s.id))
    setSummaries(list)
  }

  function loadPendingApprovals() {
    const regions = [...new Set(stores.map(s => s.region))]
    const allTransfers = []
    for (const region of regions) {
      allTransfers.push(...getAllTransfersForRegion(region))
    }
    const uniqueTransfers = []
    const seenIds = new Set()
    for (const t of allTransfers) {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id)
        uniqueTransfers.push(t)
      }
    }
    setPendingTransfers(uniqueTransfers.filter(t => t.status === 'pending'))

    const allLosses = []
    for (const s of stores) {
      const losses = getLossReports(s.id)
      for (const l of losses) {
        if (l.status === 'pending_approval') {
          const store = stores.find(st => st.id === s.id)
          allLosses.push({ ...l, storeId: s.id, storeName: store?.name || s.id })
        }
      }
    }
    setPendingLosses(allLosses)
  }

  function viewStoreDetail(storeId) {
    setSelectedStore(storeId)
    generatePrepTasks(storeId)
    setDetailTasks(getPrepTasks(storeId))
  }

  function closeDetail() {
    setSelectedStore(null)
    setDetailTasks([])
  }

  function handleApproveTransfer(transferId) {
    approveTransfer(transferId, approvalNote)
    setApprovalNote('')
    loadSummaries()
    loadPendingApprovals()
  }

  function handleRejectTransfer(transferId) {
    rejectTransfer(transferId, approvalNote)
    setApprovalNote('')
    loadSummaries()
    loadPendingApprovals()
  }

  function handleApproveLoss(storeId, lossId) {
    approveLoss(storeId, lossId)
    loadSummaries()
    loadPendingApprovals()
  }

  function handleRejectLoss(storeId, lossId) {
    rejectLoss(storeId, lossId)
    loadSummaries()
    loadPendingApprovals()
  }

  const highRiskCount = summaries.filter(s => s.riskLevel === 'high').length
  const mediumRiskCount = summaries.filter(s => s.riskLevel === 'medium').length
  const totalBelowSafety = summaries.reduce((sum, s) => sum + s.belowSafetyCount, 0)
  const totalOutOfStock = summaries.reduce((sum, s) => sum + s.outOfStockCount, 0)
  const inventoryCheckRate = summaries.length > 0
    ? Math.round(summaries.filter(s => s.inventoryCheckCompleted).length / summaries.length * 100)
    : 0
  const dailyCloseRate = summaries.length > 0
    ? Math.round(summaries.filter(s => s.dailyClosed).length / summaries.length * 100)
    : 0
  const totalInTransit = summaries.reduce((sum, s) => sum + s.inTransitCount, 0)

  const selectedStoreInfo = stores.find(s => s.id === selectedStore)

  return (
    <div className="app-container">
      <Link to="/" className="back-link">← 返回首页</Link>

      <div className="top-bar">
        <h1>📊 区域督导看板</h1>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => { loadSummaries(); loadPendingApprovals() }}>🔄 刷新数据</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">高风险门店</div>
          <div className={`value ${highRiskCount > 0 ? 'danger' : 'success'}`}>{highRiskCount}</div>
        </div>
        <div className="summary-card">
          <div className="label">中风险门店</div>
          <div className={`value ${mediumRiskCount > 0 ? 'warning' : 'success'}`}>{mediumRiskCount}</div>
        </div>
        <div className="summary-card">
          <div className="label">缺货原料总数</div>
          <div className={`value ${totalOutOfStock > 0 ? 'danger' : 'success'}`}>{totalOutOfStock}</div>
        </div>
        <div className="summary-card">
          <div className="label">低于安全库存</div>
          <div className={`value ${totalBelowSafety > 0 ? 'warning' : 'success'}`}>{totalBelowSafety}</div>
        </div>
        <div className="summary-card">
          <div className="label">在途未确认</div>
          <div className={`value ${totalInTransit > 0 ? 'warning' : 'success'}`}>{totalInTransit}</div>
        </div>
        <div className="summary-card">
          <div className="label">待审批调拨</div>
          <div className={`value ${pendingTransfers.length > 0 ? 'danger' : 'success'}`}>{pendingTransfers.length}</div>
        </div>
        <div className="summary-card">
          <div className="label">待审批报损</div>
          <div className={`value ${pendingLosses.length > 0 ? 'danger' : 'success'}`}>{pendingLosses.length}</div>
        </div>
        <div className="summary-card">
          <div className="label">日结完成率</div>
          <div className={`value ${dailyCloseRate < 100 ? 'warning' : 'success'}`}>{dailyCloseRate}%</div>
        </div>
      </div>

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          门店汇总
        </button>
        <button className={`tab-btn ${activeTab === 'transfer_approval' ? 'active' : ''}`} onClick={() => setActiveTab('transfer_approval')}>
          调拨审批 {pendingTransfers.length > 0 && <span className="status-tag danger" style={{ marginLeft: 6, fontSize: 10 }}>{pendingTransfers.length}</span>}
        </button>
        <button className={`tab-btn ${activeTab === 'loss_approval' ? 'active' : ''}`} onClick={() => setActiveTab('loss_approval')}>
          报损审批 {pendingLosses.length > 0 && <span className="status-tag danger" style={{ marginLeft: 6, fontSize: 10 }}>{pendingLosses.length}</span>}
        </button>
      </div>

      {activeTab === 'overview' && (
        selectedStore ? (
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>{selectedStoreInfo?.name} - 详细缺货清单</h3>
              <button className="btn btn-secondary btn-sm" onClick={closeDetail}>← 返回汇总</button>
            </div>
            {detailTasks.length === 0 ? (
              <div className="success-box">✅ 该门店原料均在安全线以上，无缺货风险</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>原料</th>
                    <th>分类</th>
                    <th>当前库存</th>
                    <th>安全库存</th>
                    <th>缺口量</th>
                    <th>紧急度</th>
                    <th>影响单品</th>
                  </tr>
                </thead>
                <tbody>
                  {detailTasks.map(t => (
                    <tr key={t.materialId} className={t.currentStock <= 0 ? 'row-danger' : t.belowSafety ? 'row-warning' : ''}>
                      <td>{t.materialName}</td>
                      <td>{t.category}</td>
                      <td className={t.currentStock <= 0 ? 'cell-danger' : t.belowSafety ? 'cell-warning' : ''}>
                        {t.currentStock} {t.unit}
                      </td>
                      <td>{t.safetyStock} {t.unit}</td>
                      <td className="cell-danger">{t.shortageQty} {t.unit}</td>
                      <td>
                        {t.currentStock <= 0
                          ? <span className="risk-badge risk-high">紧急缺货</span>
                          : <span className="risk-badge risk-medium">不足</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {t.affectedMenuItems.map(i => i.name).join('、') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            <div className="panel">
              <h3>门店风险汇总</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {summaries.map(s => {
                  const store = stores.find(st => st.id === s.storeId)
                  return (
                    <div key={s.storeId}
                         className={`store-summary-card risk-${s.riskLevel}`}
                         style={{ cursor: 'pointer' }}
                         onClick={() => viewStoreDetail(s.storeId)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>{store?.name || s.storeId}</h4>
                        <span className={`risk-badge risk-${s.riskLevel}`}>
                          {s.riskLevel === 'high' ? '高风险' : s.riskLevel === 'medium' ? '中风险' : '低风险'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{store?.region}</div>
                      <div className="stat-row">
                        <span>缺货原料</span>
                        <span className={s.outOfStockCount > 0 ? 'cell-danger' : 'cell-ok'}>
                          {s.outOfStockCount} 项
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>低于安全库存</span>
                        <span className={s.belowSafetyCount > 0 ? 'cell-warning' : 'cell-ok'}>
                          {s.belowSafetyCount} 项
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>库存负数</span>
                        <span className={s.negativeInventory > 0 ? 'cell-danger' : 'cell-ok'}>
                          {s.negativeInventory > 0 ? `${s.negativeInventory} 项异常` : '正常'}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>未处理报损</span>
                        <span className={s.unhandledLosses > 0 ? 'cell-warning' : 'cell-ok'}>
                          {s.unhandledLosses > 0 ? `${s.unhandledLosses} 条` : '无'}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>在途未确认</span>
                        <span className={s.inTransitCount > 0 ? 'cell-warning' : 'cell-ok'}>
                          {s.inTransitCount > 0 ? `${s.inTransitCount} 种` : '无'}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>待审批调拨</span>
                        <span className={s.pendingTransfers > 0 ? 'cell-danger' : 'cell-ok'}>
                          {s.pendingTransfers > 0 ? `${s.pendingTransfers} 条` : '无'}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>盘点状态</span>
                        <span>
                          {s.inventoryCheckCompleted
                            ? <span className="status-tag closed">已完成</span>
                            : <span className="status-tag open">未完成</span>}
                        </span>
                      </div>
                      <div className="stat-row">
                        <span>日结状态</span>
                        <span>
                          {s.dailyClosed
                            ? <span className="status-tag closed">已提交</span>
                            : <span className="status-tag open">未提交</span>}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel">
              <h3>盘点与日结完成度</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>门店</th>
                    <th>区域</th>
                    <th>盘点状态</th>
                    <th>日结状态</th>
                    <th>负库存</th>
                    <th>未处理报损</th>
                    <th>在途未确认</th>
                    <th>待审批调拨</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(s => {
                    const store = stores.find(st => st.id === s.storeId)
                    return (
                      <tr key={s.storeId}>
                        <td>{store?.name}</td>
                        <td>{store?.region}</td>
                        <td>
                          {s.inventoryCheckCompleted
                            ? <span className="status-tag closed">已完成</span>
                            : <span className="status-tag danger">未完成</span>}
                        </td>
                        <td>
                          {s.dailyClosed
                            ? <span className="status-tag closed">已提交</span>
                            : <span className="status-tag open">未提交</span>}
                        </td>
                        <td className={s.negativeInventory > 0 ? 'cell-danger' : 'cell-ok'}>
                          {s.negativeInventory > 0 ? `${s.negativeInventory} 项异常` : '正常'}
                        </td>
                        <td className={s.unhandledLosses > 0 ? 'cell-warning' : 'cell-ok'}>
                          {s.unhandledLosses > 0 ? `${s.unhandledLosses} 条` : '无'}
                        </td>
                        <td className={s.inTransitCount > 0 ? 'cell-warning' : 'cell-ok'}>
                          {s.inTransitCount > 0 ? `${s.inTransitCount} 种` : '无'}
                        </td>
                        <td className={s.pendingTransfers > 0 ? 'cell-danger' : 'cell-ok'}>
                          {s.pendingTransfers > 0 ? `${s.pendingTransfers} 条` : '无'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {activeTab === 'transfer_approval' && (
        <div className="panel">
          <h3>跨店调拨审批</h3>
          {pendingTransfers.length === 0 ? (
            <div className="success-box">✅ 暂无待审批的调拨申请</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>申请时间</th>
                  <th>原料</th>
                  <th>数量</th>
                  <th>调出店</th>
                  <th>调入店</th>
                  <th>仅停售品</th>
                  <th>审批备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingTransfers.map(t => (
                  <tr key={t.id} className="row-warning">
                    <td style={{ fontSize: 12 }}>{new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                    <td>{t.materialName}</td>
                    <td>{t.qty}</td>
                    <td>{t.fromStoreName}</td>
                    <td>{t.toStoreName}</td>
                    <td>
                      {t.isDiscontinuedOnly
                        ? <span className="status-tag danger">是（不会恢复可售）</span>
                        : <span className="status-tag info">否</span>}
                    </td>
                    <td>
                      <input type="text" className="input-sm" style={{ width: 150 }}
                             placeholder="审批备注"
                             value={approvalNote}
                             onChange={e => setApprovalNote(e.target.value)} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveTransfer(t.id)}>审批通过</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRejectTransfer(t.id)}>驳回</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ marginTop: 24, marginBottom: 12 }}>全部调拨记录</h4>
          {(() => {
            const regions = [...new Set(stores.map(s => s.region))]
            const allTransfers = []
            for (const region of regions) {
              allTransfers.push(...getAllTransfersForRegion(region))
            }
            const uniqueTransfers = []
            const seenIds = new Set()
            for (const t of allTransfers) {
              if (!seenIds.has(t.id)) {
                seenIds.add(t.id)
                uniqueTransfers.push(t)
              }
            }
            const nonPending = uniqueTransfers.filter(t => t.status !== 'pending')
            return nonPending.length === 0 ? (
              <p style={{ color: '#64748b' }}>暂无已处理的调拨记录</p>
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
                  {nonPending.map(t => (
                    <tr key={t.id} className={t.status === 'rejected' ? 'row-danger' : ''}>
                      <td style={{ fontSize: 12 }}>{new Date(t.createdAt).toLocaleString('zh-CN')}</td>
                      <td>{t.materialName}</td>
                      <td>{t.qty}</td>
                      <td>{t.fromStoreName}</td>
                      <td>{t.toStoreName}</td>
                      <td>
                        {t.status === 'approved' && <span className="status-tag closed">已审批</span>}
                        {t.status === 'rejected' && <span className="status-tag danger">已驳回</span>}
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{t.supervisorNote || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      )}

      {activeTab === 'loss_approval' && (
        <div className="panel">
          <h3>报损审批</h3>
          {pendingLosses.length === 0 ? (
            <div className="success-box">✅ 暂无待审批的报损记录</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>报损时间</th>
                  <th>门店</th>
                  <th>原料</th>
                  <th>数量</th>
                  <th>原因</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingLosses.map(l => (
                  <tr key={l.id} className="row-warning">
                    <td style={{ fontSize: 12 }}>{new Date(l.createdAt).toLocaleString('zh-CN')}</td>
                    <td>{l.storeName}</td>
                    <td>{l.materialName}</td>
                    <td>{l.qty}</td>
                    <td>{l.reason}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleApproveLoss(l.storeId, l.id)}>审批通过</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleRejectLoss(l.storeId, l.id)}>驳回</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
