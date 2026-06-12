import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getStores } from './storage/seedData.js'
import { getFromStorage, setToStorage, StorageKeys } from './storage/storage.js'
import {
  getInventory, getSalesForecast, getSafetyStock, generatePrepTasks,
  isInventoryCheckCompleted, isDailyClosed, getLossReports, getStoreSummary
} from './storage/inventory.js'

export default function App() {
  const stores = getStores()
  const [currentStore, setCurrentStore] = useState(
    () => getFromStorage(StorageKeys.CURRENT_STORE, stores[0]?.id || '')
  )
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    setToStorage(StorageKeys.CURRENT_STORE, currentStore)
    if (currentStore) {
      setSummary(getStoreSummary(currentStore))
    }
  }, [currentStore])

  const today = new Date().toLocaleDateString('zh-CN')

  return (
    <div className="app-container">
      <div className="top-bar">
        <h1>🍵 茶饮门店备料看板</h1>
        <div className="store-select">
          <span>当前门店：</span>
          <select value={currentStore} onChange={e => setCurrentStore(e.target.value)}>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {summary && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">今日日期</div>
            <div className="value" style={{ fontSize: 18 }}>{today}</div>
          </div>
          <div className="summary-card">
            <div className="label">风险等级</div>
            <div className={`value ${
              summary.riskLevel === 'high' ? 'danger' :
              summary.riskLevel === 'medium' ? 'warning' : 'success'
            }`} style={{ fontSize: 22 }}>
              {summary.riskLevel === 'high' ? '高' : summary.riskLevel === 'medium' ? '中' : '低'}
            </div>
          </div>
          <div className="summary-card">
            <div className="label">低于安全库存</div>
            <div className={`value ${summary.belowSafetyCount > 0 ? 'danger' : 'success'}`}>
              {summary.belowSafetyCount}
            </div>
          </div>
          <div className="summary-card">
            <div className="label">缺货原料</div>
            <div className={`value ${summary.outOfStockCount > 0 ? 'danger' : 'success'}`}>
              {summary.outOfStockCount}
            </div>
          </div>
          <div className="summary-card">
            <div className="label">盘点状态</div>
            <div className={`value ${summary.inventoryCheckCompleted ? 'success' : 'warning'}`}
                 style={{ fontSize: 16 }}>
              {summary.inventoryCheckCompleted ? '已完成' : '未完成'}
            </div>
          </div>
          <div className="summary-card">
            <div className="label">日结状态</div>
            <div className={`value ${summary.dailyClosed ? 'success' : 'warning'}`} style={{ fontSize: 16 }}>
              {summary.dailyClosed ? '已提交' : '未提交'}
            </div>
          </div>
        </div>
      )}

      <div className="role-nav">
        <Link to="/manager" className="role-card">
          <div className="icon">📋</div>
          <h2>店长工作台</h2>
          <p>录入原料库存、今日销量预估、安全库存设置<br/>
             盘点管理、报损记录、日结提交与更正</p>
        </Link>
        <Link to="/staff" className="role-card">
          <div className="icon">👨‍🍳</div>
          <h2>吧员工作台</h2>
          <p>按菜单查看待补料任务与替代原料<br/>
             实时掌握可售单品与缺货预警</p>
        </Link>
        <Link to="/supervisor" className="role-card">
          <div className="icon">📊</div>
          <h2>区域督导</h2>
          <p>多门店缺货汇总、盘点完成度统计<br/>
             日结状态监控与风险等级总览</p>
        </Link>
      </div>

      <div className="home-section">
        <h2>功能说明</h2>
        <ul className="feature-list">
          <li>低于安全库存醒目标记，自动关联影响可售单品</li>
          <li>已停菜单品自动过滤，不生成备料任务</li>
          <li>跨店调拨：低于安全库存可向同区域门店申请调拨，督导审批</li>
          <li>调拨审批后自动扣减调出店库存，增加调入店在途量</li>
          <li>报损审批：吧员登记报损→提交审批→督导审核，未处理报损阻止日结</li>
          <li>已停菜单品不会因调拨自动恢复可售</li>
          <li>盘点未完成/负库存/未处理报损/在途未确认 均拦截日结</li>
          <li>日结后库存调整只能走更正记录，保留审计痕迹</li>
          <li>所有前端数据存储在浏览器 localStorage 中</li>
          <li>多门店切换查看，督导汇总区域整体情况</li>
        </ul>
      </div>
    </div>
  )
}
