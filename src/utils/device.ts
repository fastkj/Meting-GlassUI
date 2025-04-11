/**
 * 检测当前设备是否为移动设备
 * 
 * @returns {boolean} 是否为移动设备
 */
export function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // 检测用户代理
  const isMobileByUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  // 检测屏幕宽度
  const isMobileByWidth = window.innerWidth <= 768;
  
  // 检测触摸支持
  const isMobileByTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // 综合判断
  return isMobileByUA || isMobileByWidth || isMobileByTouch;
}

/**
 * 格式化时间为 MM:SS 格式
 * 
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 保存数据到本地存储
 * 
 * @param {string} key 存储键名
 * @param {any} value 存储值
 */
export function saveToStorage(key: string, value: any): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(`meting-glassui:${key}`, JSON.stringify(value));
  } catch (err) {
    console.error('保存到本地存储失败:', err);
  }
}

/**
 * 从本地存储获取数据
 * 
 * @param {string} key 存储键名
 * @param {any} defaultValue 默认值
 * @returns {any} 存储的值或默认值
 */
export function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  
  try {
    const value = localStorage.getItem(`meting-glassui:${key}`);
    return value ? JSON.parse(value) : defaultValue;
  } catch (err) {
    console.error('从本地存储获取数据失败:', err);
    return defaultValue;
  }
} 