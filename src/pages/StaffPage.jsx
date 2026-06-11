import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStores, getMaterials, getMenuItems, getOnSaleMenuItems, getMaterialById } from '../storage/seedData.js'
import { getFromStorage, setToStorage, StorageKeys } from '../storage/storage.js'
import {
  generatePrepTasks, getPrepTasks,
  getInventory, getSafetyStock, getSalesForecast,
  getAvailableMenuItems
} from '../storage/inventory.js'

export default function StaffPage() {
  const stores = getStores()
  const [currentStore, setCurrentStore] = useState(
    () => getFromStorage(StorageKeys.CURRENT_STORE, stores[0]?.id || '')
  )
  const [activeTab, setActiveTab] = useState('tasks')
  const [prepTasks, setPrepTasks] = useState([])
  const [availableItems, setAvailableItems] = useState([])
  const [filterCategory, setFilterCategory] = useState('all')

  useEffect(() => {
    setToStorage(StorageKeys.CURRENT_STORE, currentStore)
    refreshData()
  }, [currentStore])

  function refreshData() {
    const tasks = generatePrepTasks(currentStore)
    setPrepTasks(tasks)
    setAvailableItems(getAvailableMenuItems(currentStore))
  }

  const categories = ['all', ...new Set(getMaterials().map(m => m.category))]

  const filteredTasks = filterCategory === 'all'
    ? prepTasks
    : prepTasks.filter(t => t.category === filterCategory)

  const criticalCount = prepTasks.filter(t => t.currentStock <= 0).length
  const warningCount = prepTasks.filter(t => t.belowSafety && t.currentStock > 0).length

  return (
    <div className="app-container">
      <Link to="/" className="back-link">← 返回首页</Link>

      <div className="top-bar">
        <h1>👨‍🍳 吧员工作台</h1>
        <div className="store-select">
          <span>门店：</span>
          <select value={currentStore} onChange={e => setCurrentStore(e.target.value)}>
            {stores.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">紧急缺货</div>
          <div className={`value ${criticalCount > 0 ? 'danger' : 'success'}`}>{criticalCount}</div>
        </div>
        <div className="summary-card">
          <div className="label">低于安全库存</div>
          <div className={`value ${warningCount > 0 ? 'warning' : 'success'}`}>{warningCount}</div>
        </div>
        <div className="summary-card">
          <div className="label">待补料任务</div>
          <div className="value">{prepTasks.length}</div>
        </div>
      </div>

      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
          待补料清单
        </button>
        <button className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
          可售单品
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div className="panel">
          <h3>
            待补料任务
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={refreshData}>
              🔄 刷新任务
            </button>
          </h3>

          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {categories.map(c => (
              <button key={c}
                      className={`tab-btn ${filterCategory === c ? 'active' : ''}`}
                      style={{ flex: 'none', padding: '6px 14px' }}
                      onClick={() => setFilterCategory(c)}>
                {c === 'all' ? '全部' : c}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="success-box">🎉 所有原料库存充足，暂无补料任务！</div>
          ) : (
            filteredTasks.map(task => {
              const isCritical = task.currentStock <= 0
              return (
                <div key={task.materialId} className={`prep-task-card ${isCritical ? 'critical' : 'warning'}`}>
                  <div className="task-header">
                    <span className="task-name">
                      {isCritical && '🚨 '}{!isCritical && task.belowSafety && '⚠️ '}
                      {task.materialName}
                    </span>
                    <span className={`risk-badge ${isCritical ? 'risk-high' : 'risk-medium'}`}>
                      {isCritical ? '紧急缺货' : task.belowSafety ? '低于安全库存' : '需备货'}
                    </span>
                  </div>
                  <div className="task-meta">
                    <span>当前库存：<strong className={isCritical ? 'cell-danger' : task.belowSafety ? 'cell-warning' : ''}>
                      {task.currentStock} {task.unit}
                    </strong></span>
                    <span>安全库存：<strong>{task.safetyStock} {task.unit}</strong></span>
                    <span>预计需求：<strong>{Number(task.demandedQty.toFixed(2))} {task.unit}</strong></span>
                    <span>需补量：<strong className="cell-danger">{task.shortageQty} {task.unit}</strong></span>
                  </div>
                  {task.alternatives.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#475569' }}>可用替代：</span>
                      {task.alternatives.map(a => (
                        <span key={a.id} className="alt-tag">
                          {a.name} (可用 {a.available} {a.unit}，比例 {a.ratio}:1)
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="affected">
                    影响单品：{task.affectedMenuItems.map(i => i.name).join('、') || '—'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="panel">
          <h3>可售单品看板</h3>
          {availableItems.length === 0 ? (
            <p style={{ color: '#64748b' }}>暂无菜单数据</p>
          ) : (
            availableItems.map(item => {
              let cardClass = ''
              let statusLabel = ''
              if (item.saleStatus === 'unavailable') {
                cardClass = 'unavailable'
                statusLabel = '🚫 不可售'
              } else if (item.saleStatus === 'warning') {
                cardClass = 'warning'
                statusLabel = '⚠️ 原料不足'
              } else if (item.saleStatus === 'discontinued') {
                cardClass = 'discontinued'
                statusLabel = '已停售'
              } else {
                statusLabel = '✅ 正常可售'
              }
              return (
                <div key={item.id} className={`menu-item-card ${cardClass}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong>{item.name}</strong>
                    <span className={`status-tag ${
                      item.saleStatus === 'unavailable' ? 'danger' :
                      item.saleStatus === 'warning' ? 'open' :
                      item.saleStatus === 'discontinued' ? '' : 'closed'
                    }`}>
                      {statusLabel}
                    </span>
                  </div>
                  {item.saleStatus !== 'discontinued' && (
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      配方：
                      {item.recipe.map(r => {
                        const mat = getMaterialById(r.materialId)
                        return `${mat?.name || r.materialId} ${r.qty}`
                      }).join(' + ')}
                    </div>
                  )}
                  {item.shortageMaterials && item.shortageMaterials.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#dc2626' }}>
                      低于安全库存：
                      {item.shortageMaterials.map(m => `${m.name}(库存${m.stock}/安全${m.safetyStock})`).join('，')}
                    </div>
                  )}
                  {item.saleStatus === 'discontinued' && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                      已停菜单品不生成备料任务
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
