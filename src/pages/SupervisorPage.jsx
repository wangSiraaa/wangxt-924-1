import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStores, getMaterials } from '../storage/seedData.js'
import {
  getStoreSummary, generatePrepTasks, getPrepTasks,
  isInventoryCheckCompleted, isDailyClosed,
  getInventory, getLossReports, getSafetyStock
} from '../storage/inventory.js'

export default function SupervisorPage() {
  const stores = getStores()
  const [summaries, setSummaries] = useState([])
  const [selectedStore, setSelectedStore] = useState(null)
  const [detailTasks, setDetailTasks] = useState([])

  useEffect(() => {
    loadSummaries()
  }, [])

  function loadSummaries() {
    const list = stores.map(s => getStoreSummary(s.id))
    setSummaries(list)
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

  const selectedStoreInfo = stores.find(s => s.id === selectedStore)

  return (
    <div className="app-container">
      <Link to="/" className="back-link">← 返回首页</Link>

      <div className="top-bar">
        <h1>📊 区域督导看板</h1>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={loadSummaries}>🔄 刷新数据</button>
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
          <div className="label">盘点完成率</div>
          <div className={`value ${inventoryCheckRate < 100 ? 'warning' : 'success'}`}>{inventoryCheckRate}%</div>
        </div>
        <div className="summary-card">
          <div className="label">日结完成率</div>
          <div className={`value ${dailyCloseRate < 100 ? 'warning' : 'success'}`}>{dailyCloseRate}%</div>
        </div>
      </div>

      {selectedStore ? (
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
