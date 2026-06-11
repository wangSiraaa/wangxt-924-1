import { getFromStorage, setToStorage, StorageKeys } from './storage.js'

export const STORES = [
  { id: 'S001', name: '朝阳门店', region: '北京东区' },
  { id: 'S002', name: '国贸店', region: '北京东区' },
  { id: 'S003', name: '三里屯店', region: '北京北区' }
]

export const MATERIALS = [
  { id: 'M001', name: '红茶茶底', unit: 'L', category: '茶底',
    alternatives: [{ id: 'M009', name: '乌龙茶茶底', ratio: 1 }] },
  { id: 'M002', name: '绿茶茶底', unit: 'L', category: '茶底',
    alternatives: [{ id: 'M001', name: '红茶茶底', ratio: 1 }] },
  { id: 'M003', name: '茉莉茶底', unit: 'L', category: '茶底', alternatives: [] },
  { id: 'M004', name: '牛奶', unit: 'L', category: '乳品', alternatives: [] },
  { id: 'M005', name: '椰奶', unit: 'L', category: '乳品',
    alternatives: [{ id: 'M004', name: '牛奶', ratio: 1 }] },
  { id: 'M006', name: '珍珠', unit: 'kg', category: '小料', alternatives: [] },
  { id: 'M007', name: '椰果', unit: 'kg', category: '小料', alternatives: [] },
  { id: 'M008', name: '糖浆', unit: 'L', category: '调味', alternatives: [] },
  { id: 'M009', name: '乌龙茶茶底', unit: 'L', category: '茶底', alternatives: [] },
  { id: 'M010', name: '芋泥', unit: 'kg', category: '小料', alternatives: [] }
]

export const MENU_ITEMS = [
  {
    id: 'D001',
    name: '珍珠奶茶',
    status: 'on_sale',
    recipe: [
      { materialId: 'M001', qty: 0.2 },
      { materialId: 'M004', qty: 0.15 },
      { materialId: 'M006', qty: 0.05 },
      { materialId: 'M008', qty: 0.02 }
    ]
  },
  {
    id: 'D002',
    name: '茉莉奶绿',
    status: 'on_sale',
    recipe: [
      { materialId: 'M003', qty: 0.2 },
      { materialId: 'M004', qty: 0.15 },
      { materialId: 'M008', qty: 0.02 }
    ]
  },
  {
    id: 'D003',
    name: '椰香乌龙',
    status: 'on_sale',
    recipe: [
      { materialId: 'M009', qty: 0.25 },
      { materialId: 'M005', qty: 0.1 },
      { materialId: 'M008', qty: 0.02 }
    ]
  },
  {
    id: 'D004',
    name: '芋泥波波奶茶',
    status: 'on_sale',
    recipe: [
      { materialId: 'M001', qty: 0.2 },
      { materialId: 'M004', qty: 0.15 },
      { materialId: 'M010', qty: 0.06 },
      { materialId: 'M006', qty: 0.03 },
      { materialId: 'M008', qty: 0.02 }
    ]
  },
  {
    id: 'D005',
    name: '柠檬绿茶',
    status: 'discontinued',
    recipe: [
      { materialId: 'M002', qty: 0.25 },
      { materialId: 'M008', qty: 0.03 }
    ]
  }
]

export function initSeedData() {
  if (!getFromStorage(StorageKeys.STORES)) {
    setToStorage(StorageKeys.STORES, STORES)
  }
  if (!getFromStorage(StorageKeys.MATERIALS)) {
    setToStorage(StorageKeys.MATERIALS, MATERIALS)
  }
  if (!getFromStorage(StorageKeys.MENU_ITEMS)) {
    setToStorage(StorageKeys.MENU_ITEMS, MENU_ITEMS)
  }
}

export function getStores() {
  return getFromStorage(StorageKeys.STORES, [])
}

export function getMaterials() {
  return getFromStorage(StorageKeys.MATERIALS, [])
}

export function getMenuItems() {
  return getFromStorage(StorageKeys.MENU_ITEMS, [])
}

export function getOnSaleMenuItems() {
  return getMenuItems().filter(m => m.status === 'on_sale')
}

export function getMaterialById(id) {
  return getMaterials().find(m => m.id === id)
}

export function getMenuItemById(id) {
  return getMenuItems().find(m => m.id === id)
}
