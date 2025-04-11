<template>
  <div 
    class="meting-glassui-player" 
    :class="{ 
      'active': isActive, 
      'playing': isPlaying, 
      'loading': isLoading,
      'snap-left': snapPosition === 'left',
      'snap-right': snapPosition === 'right',
      'is-mobile': isMobile,
      'long-pressing': isLongPressing,
      'panel-open': isPanelOpen
    }"
    :style="playerPosition"
    @mousedown="startDrag"
    @touchstart="handleTouchStart"
    ref="musicPlayerRef"
  >
    <!-- 移动端遮罩层 - 点击关闭面板 -->
    <div 
      v-if="isMobile && isPanelOpen" 
      class="mobile-overlay"
      @click="hidePanel"
    ></div>
    
    <!-- 播放器悬浮球 -->
    <div 
      class="music-ball" 
      @click="handleClick"
      @mouseenter="showPanel"
      @mouseleave="startHideTimer"
      @touchstart.prevent="handleBallTouchStart"
      @touchend.prevent="handleBallTouchEnd"
    >
      <div class="ball-ripple" :class="{ 'is-playing': isPlaying }"></div>
      <div class="music-icon-mini">
        <span v-if="isLoading" class="loading-icon-mini"></span>
        <span v-else-if="isPlaying" class="pause-icon-mini"></span>
        <span v-else class="play-icon-mini"></span>
      </div>
      <div v-if="isPlaying" class="now-playing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <!-- 播放模式提示 -->
      <div class="play-mode-tooltip" v-if="isPanelOpen">
        {{ playModeText }}
      </div>
    </div>
    
    <!-- 音乐面板 -->
    <div 
      v-if="isPanelOpen" 
      class="music-panel"
      @mouseenter="clearHideTimer"
      @mouseleave="startHideTimer"
    >
      <div class="panel-header">
        <div class="panel-logo">Meting GlassUI</div>
        <div class="panel-buttons">
          <button class="panel-btn" @click="togglePlayMode" title="切换播放模式">
            <span 
              :class="{ 
                'mode-list': playMode === 'list',
                'mode-random': playMode === 'random',
                'mode-single': playMode === 'single'
              }"
            ></span>
          </button>
          <button class="panel-btn" @click="toggleVolume" title="音量控制">
            <span 
              :class="{ 
                'volume-high': volume > 0.5 && !isMuted,
                'volume-low': volume <= 0.5 && volume > 0 && !isMuted,
                'volume-mute': volume === 0 || isMuted
              }"
            ></span>
          </button>
        </div>
      </div>
      
      <!-- 音量控制条 -->
      <div class="volume-control" v-if="isVolumeVisible">
        <div class="volume-slider" 
          @click="setVolumeFromClick"
          @mousedown="startVolumeDrag"
        >
          <div class="volume-bg"></div>
          <div class="volume-current" :style="{ width: `${volume * 100}%` }"></div>
          <div class="volume-handle" :style="{ left: `${volume * 100}%` }"></div>
        </div>
      </div>
      
      <!-- 当前播放 -->
      <div class="now-playing">
        <div class="current-song-cover" v-if="currentSong && currentSong.cover">
          <img :src="currentSong.cover" alt="封面">
          <div class="vinyl-effect" :class="{ 'rotating': isPlaying }"></div>
        </div>
        
        <div class="current-song-info">
          <div class="song-name">{{ currentSong?.name || '未选择歌曲' }}</div>
          <div class="song-artist">{{ currentSong?.artist || '未知艺术家' }}</div>
          
          <!-- 歌曲进度条 -->
          <div class="progress-bar" 
            @mousedown="startProgressDrag"
            @touchstart="startProgressDrag"
            @click="seekToPosition"
          >
            <div class="progress-bg"></div>
            <div class="progress-current" :style="{ width: `${progress}%` }"></div>
            <div class="progress-handle" :style="{ left: `${progress}%` }"></div>
            <div class="time-info">
              <span class="current-time">{{ formatTime(currentTime) }}</span>
              <span class="total-time">{{ formatTime(duration) }}</span>
            </div>
          </div>
          
          <!-- 播放控制 -->
          <div class="player-controls">
            <button class="ctrl-btn prev-btn" @click="prevSong">
              <span class="prev-icon"></span>
            </button>
            
            <button class="ctrl-btn play-btn" @click="togglePlay">
              <span v-if="isPlaying" class="pause-icon"></span>
              <span v-else class="play-icon"></span>
            </button>
            
            <button class="ctrl-btn next-btn" @click="nextSong">
              <span class="next-icon"></span>
            </button>
            
            <button class="ctrl-btn list-btn" @click="togglePlaylist">
              <span class="list-icon"></span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 播放列表 -->
      <div class="playlist-container" v-if="isPlaylistVisible">
        <div class="playlist-header">
          <h3>播放列表 ({{ playlist.length }})</h3>
          <button class="close-btn" @click="togglePlaylist">
            <span class="close-icon"></span>
          </button>
        </div>
        
        <ul class="playlist">
          <li 
            v-for="(song, index) in playlist" 
            :key="index"
            :class="{ 'active': index === currentIndex }"
            @click="playSong(index)"
          >
            <div class="song-cover" v-if="song.cover">
              <img :src="song.cover" alt="封面">
            </div>
            <div class="song-info">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ song.artist }}</div>
            </div>
            <div class="song-duration" v-if="index === currentIndex">
              <span class="playing-icon" v-if="isPlaying"></span>
              <span v-else>当前</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- 隐藏的音频容器 -->
    <div class="player-container-inner" ref="playerContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { usePlayer } from '../utils/playerControl';
import { detectMobileDevice, formatTime, saveToStorage, getFromStorage } from '../utils/device';
import type { Song, PlayerConfig } from '../types';

// 组件属性
interface Props {
  /**
   * 播放器配置
   */
  config: PlayerConfig;
  
  /**
   * 自定义CSS类
   */
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  customClass: ''
});

// 播放器状态
const isActive = ref(false);
const isLoading = ref(true);
const isPanelOpen = ref(false);
const isPlaylistVisible = ref(false);
const isVolumeVisible = ref(false);
const isMobile = ref(false);
const snapPosition = ref<'left' | 'right'>(props.config.defaultPosition || 'right');
const position = ref({ x: 20, y: 80 });
const hideTimer = ref<number | null>(null);
const isDragging = ref(false);
const startPos = ref({ x: 0, y: 0 });
const isLongPressing = ref(false);
const longPressTimer = ref<number | null>(null);
const isDraggingProgress = ref(false);
const isDraggingVolume = ref(false);
const progress = ref(0);
const musicPlayerRef = ref<HTMLElement | null>(null);
const playerContainer = ref<HTMLElement | null>(null);

// 创建播放器实例
const {
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  currentIndex,
  playlist,
  currentSong,
  isLoading: playerLoading,
  playMode,
  play,
  pause,
  toggle,
  next: nextSong,
  prev: prevSong,
  seek,
  setVolume,
  playIndex
} = usePlayer(props.config);

// 同步状态
watch(playerLoading, (val) => {
  isLoading.value = val;
});

// 播放模式文本
const playModeText = computed(() => {
  switch (playMode.value) {
    case 'list': return '列表循环';
    case 'random': return '随机播放';
    case 'single': return '单曲循环';
    default: return '列表循环';
  }
});

// 计算播放器位置样式
const playerPosition = computed(() => {
  if (isMobile.value) {
    if (snapPosition.value === 'left') {
      return {
        left: '15px',
        bottom: '70px',
        right: 'auto'
      };
    } else {
      return {
        right: '15px',
        bottom: '70px',
        left: 'auto'
      };
    }
  } else {
    return {
      left: snapPosition.value === 'left' ? `${position.value.x}px` : 'auto',
      right: snapPosition.value === 'right' ? `${position.value.x}px` : 'auto',
      bottom: `${position.value.y}px`
    };
  }
});

// 播放器事件和方法
function togglePlay() {
  toggle();
}

function playSong(index: number) {
  playIndex(index);
}

function togglePlayMode() {
  // 循环切换播放模式: list -> random -> single -> list
  if (playMode.value === 'list') {
    playMode.value = 'random';
  } else if (playMode.value === 'random') {
    playMode.value = 'single';
  } else {
    playMode.value = 'list';
  }
  
  // 保存播放模式
  saveToStorage('playMode', playMode.value);
}

function toggleVolume() {
  if (isMuted.value) {
    isMuted.value = false;
    if (volume.value === 0) {
      setVolume(0.7);
    }
  } else if (volume.value > 0) {
    isMuted.value = true;
    // 记住当前音量，但设置为0
    setVolume(0);
  } else {
    setVolume(0.7);
  }
  
  // 显示音量控制
  isVolumeVisible.value = true;
  clearTimeout(volumeHideTimer);
  volumeHideTimer = setTimeout(() => {
    isVolumeVisible.value = false;
  }, 3000);
}

let volumeHideTimer: number;

function setVolumeFromClick(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  let percentage = x / rect.width;
  
  // 限制范围
  if (percentage < 0) percentage = 0;
  if (percentage > 1) percentage = 1;
  
  setVolume(percentage);
  saveToStorage('volume', percentage);
}

function startVolumeDrag(e: MouseEvent) {
  isDraggingVolume.value = true;
  
  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingVolume.value) return;
    
    const container = document.querySelector('.volume-slider') as HTMLElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let percentage = x / rect.width;
    
    // 限制范围
    if (percentage < 0) percentage = 0;
    if (percentage > 1) percentage = 1;
    
    setVolume(percentage);
  };
  
  const onMouseUp = () => {
    isDraggingVolume.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // 保存音量
    saveToStorage('volume', volume.value);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  // 初始移动，确保设置初始值
  onMouseMove(e);
}

function togglePlaylist() {
  isPlaylistVisible.value = !isPlaylistVisible.value;
}

function showPanel() {
  isPanelOpen.value = true;
  clearHideTimer();
}

function hidePanel() {
  isPanelOpen.value = false;
  isPlaylistVisible.value = false;
  isVolumeVisible.value = false;
}

function startHideTimer() {
  clearHideTimer();
  hideTimer.value = window.setTimeout(() => {
    hidePanel();
  }, 3000);
}

function clearHideTimer() {
  if (hideTimer.value) {
    clearTimeout(hideTimer.value);
    hideTimer.value = null;
  }
}

// 处理点击事件
function handleClick() {
  if (isLongPressing.value) {
    isLongPressing.value = false;
    return;
  }
  
  if (isPanelOpen.value) {
    hidePanel();
  } else {
    togglePlay();
  }
}

// 拖动相关逻辑
function startDrag(e: MouseEvent) {
  if (!musicPlayerRef.value || isPanelOpen.value) return;
  
  isDragging.value = true;
  
  // 记录起始位置
  startPos.value = {
    x: e.clientX,
    y: e.clientY
  };
  
  // 鼠标移动事件
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    
    // 计算位移
    const deltaX = e.clientX - startPos.value.x;
    const deltaY = e.clientY - startPos.value.y;
    
    // 更新位置
    updatePosition(deltaX, deltaY);
    
    // 更新起始位置为当前位置
    startPos.value = {
      x: e.clientX,
      y: e.clientY
    };
  };
  
  // 鼠标松开事件
  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    
    // 保存当前位置
    savePositionState();
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// 移动端触摸事件
function handleTouchStart(e: TouchEvent) {
  if (!musicPlayerRef.value || isPanelOpen.value) return;
  
  // 阻止默认行为，避免拖动时触发其他事件
  e.preventDefault();
  
  isDragging.value = true;
  
  // 记录起始位置
  startPos.value = {
    x: e.touches[0].clientX,
    y: e.touches[0].clientY
  };
  
  // 触摸移动事件
  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging.value) return;
    
    // 计算位移
    const deltaX = e.touches[0].clientX - startPos.value.x;
    const deltaY = e.touches[0].clientY - startPos.value.y;
    
    // 更新位置
    updatePosition(deltaX, deltaY);
    
    // 更新起始位置为当前位置
    startPos.value = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };
  
  // 触摸结束事件
  const onTouchEnd = () => {
    isDragging.value = false;
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    
    // 保存当前位置
    savePositionState();
    
    // 判断是否为左右侧
    snapToEdge();
  };
  
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

// 判断并更新位置
function updatePosition(deltaX: number, deltaY: number) {
  if (isMobile.value) {
    // 移动端只需要更新 Y 坐标
    position.value.y = Math.max(60, position.value.y - deltaY);
  } else {
    // 桌面端更新 X 和 Y 坐标
    if (snapPosition.value === 'left') {
      position.value.x = Math.max(20, position.value.x + deltaX);
    } else {
      position.value.x = Math.max(20, position.value.x - deltaX);
    }
    position.value.y = Math.max(80, position.value.y - deltaY);
  }
}

// 保存位置状态
function savePositionState() {
  saveToStorage('playerPosition', {
    x: position.value.x,
    y: position.value.y,
    snap: snapPosition.value
  });
}

// 加载保存的状态
function loadSavedState() {
  // 加载位置
  const savedPosition = getFromStorage('playerPosition', {
    x: 20,
    y: 80,
    snap: props.config.defaultPosition || 'right'
  });
  
  position.value = {
    x: savedPosition.x,
    y: savedPosition.y
  };
  
  snapPosition.value = savedPosition.snap as 'left' | 'right';
  
  // 加载播放模式
  playMode.value = getFromStorage('playMode', props.config.playMode || 'list');
  
  // 加载音量
  const savedVolume = getFromStorage('volume', props.config.volume || 0.7);
  setVolume(savedVolume);
}

// 移动设备触摸处理
function handleBallTouchStart(e: TouchEvent) {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
  
  longPressTimer.value = window.setTimeout(() => {
    isLongPressing.value = true;
    isPanelOpen.value = true;
  }, 500);
}

function handleBallTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
  
  setTimeout(() => {
    isLongPressing.value = false;
  }, 100);
}

// 自动靠边
function snapToEdge() {
  if (!musicPlayerRef.value || !isMobile.value) return;
  
  const screenWidth = window.innerWidth;
  const rect = musicPlayerRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  
  // 判断是否为左侧
  if (centerX < screenWidth / 2) {
    snapPosition.value = 'left';
  } else {
    snapPosition.value = 'right';
  }
  
  // 保存状态
  savePositionState();
}

// 进度条拖动
function startProgressDrag(e: MouseEvent | TouchEvent) {
  e.preventDefault();
  
  isDraggingProgress.value = true;
  
  // 获取初始位置
  const isTouch = 'touches' in e;
  const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
  
  // 设置初始进度
  updateProgressFromPosition(clientX);
  
  // 移动事件
  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!isDraggingProgress.value) return;
    
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    
    updateProgressFromPosition(clientX);
  };
  
  // 结束事件
  const onEnd = () => {
    isDraggingProgress.value = false;
    
    // 设置音频位置
    if (duration.value > 0) {
      seek((progress.value / 100) * duration.value);
    }
    
    document.removeEventListener('mousemove', onMove as any);
    document.removeEventListener('touchmove', onMove as any);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
  };
  
  document.addEventListener('mousemove', onMove as any);
  document.addEventListener('touchmove', onMove as any, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function updateProgressFromPosition(clientX: number) {
  const progressBar = document.querySelector('.progress-bar') as HTMLElement;
  if (!progressBar) return;
  
  const rect = progressBar.getBoundingClientRect();
  const x = clientX - rect.left;
  
  // 计算百分比
  let percentage = (x / rect.width) * 100;
  
  // 限制范围
  percentage = Math.max(0, Math.min(100, percentage));
  
  // 更新进度
  progress.value = percentage;
}

// 点击进度条直接跳转
function seekToPosition(e: MouseEvent) {
  // 如果正在拖动，跳过
  if (isDraggingProgress.value) return;
  
  updateProgressFromPosition(e.clientX);
  
  // 设置音频位置
  if (duration.value > 0) {
    seek((progress.value / 100) * duration.value);
  }
}

// 组件挂载
onMounted(() => {
  if (typeof window === 'undefined') {
    console.error('MusicPlayer: window未定义，服务器端渲染中');
    return;
  }
  
  // 激活播放器可见性
  isActive.value = true;
  
  // 检测是否为移动设备
  isMobile.value = detectMobileDevice();
  
  // 监听窗口大小变化，更新移动设备状态
  window.addEventListener('resize', () => {
    isMobile.value = detectMobileDevice();
    // 调整位置以适应新的屏幕尺寸
    adjustPositionForScreenSize();
  });
  
  // 加载保存的状态
  try {
    loadSavedState();
  } catch (err) {
    console.error('加载保存的状态失败:', err);
    // 设置默认位置
    position.value = { x: 20, y: 80 };
  }
  
  // 如果是移动设备，自动调整位置
  if (isMobile.value) {
    adjustPositionForMobile();
  }
  
  // 监听时间更新
  watch(currentTime, () => {
    if (!isDraggingProgress.value && duration.value > 0) {
      progress.value = (currentTime.value / duration.value) * 100;
    }
  });
});

// 组件卸载
onBeforeUnmount(() => {
  // 移除事件监听
  window.removeEventListener('resize', () => {});
  
  // 清除可能存在的计时器
  if (hideTimer.value) {
    clearTimeout(hideTimer.value);
  }
  
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
  
  if (volumeHideTimer) {
    clearTimeout(volumeHideTimer);
  }
});

// 为移动设备调整位置
function adjustPositionForMobile() {
  // 设置一个合适的移动设备默认位置
  position.value = { 
    x: 20, 
    y: 80
  };
  
  // 默认靠右
  snapPosition.value = 'right';
  
  // 保存状态
  savePositionState();
}

// 根据屏幕尺寸调整位置
function adjustPositionForScreenSize() {
  if (!musicPlayerRef.value) return;
  
  const rect = musicPlayerRef.value.getBoundingClientRect();
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // 确保不超出屏幕边界
  if (snapPosition.value === 'left') {
    position.value.x = Math.min(position.value.x, screenWidth - rect.width);
  } else {
    position.value.x = Math.min(position.value.x, screenWidth - rect.width);
  }
  
  // 确保底部位置合适
  const minBottom = isMobile.value ? 60 : 80;
  position.value.y = Math.max(minBottom, Math.min(position.value.y, screenHeight - rect.height));
  
  // 保存状态
  savePositionState();
}
</script>

<style>
.meting-glassui-player {
  position: fixed;
  right: 20px;
  bottom: 80px;
  z-index: 999;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  opacity: 0;
  user-select: none;
  touch-action: none;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.meting-glassui-player.active {
  opacity: 1;
}

/* 播放器容器 */
.player-container-inner {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  z-index: -1;
}

/* 全新霓虹风格悬浮球 */
.music-ball {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 30px;
  cursor: pointer;
  position: relative;
  box-shadow: 
    0 0 15px rgba(90, 66, 228, 0.5),
    0 0 30px rgba(90, 66, 228, 0.3),
    0 0 0 1px rgba(90, 66, 228, 0.5) inset;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  transition: all 0.3s ease;
  z-index: 1001;
}

.music-ball:hover {
  transform: scale(1.05);
  box-shadow: 
    0 0 20px rgba(90, 66, 228, 0.6),
    0 0 40px rgba(90, 66, 228, 0.4),
    0 0 0 1px rgba(90, 66, 228, 0.6) inset;
}

.music-ball:active {
  transform: scale(0.95);
}

.meting-glassui-player.playing .music-ball {
  box-shadow: 
    0 0 20px rgba(90, 66, 228, 0.6),
    0 0 40px rgba(90, 66, 228, 0.4),
    0 0 0 1px rgba(90, 66, 228, 0.7) inset;
}

.ball-ripple {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;
  z-index: 0;
}

.ball-ripple.is-playing:before {
  content: '';
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 50%;
  background: rgba(90, 66, 228, 0.2);
  animation: ripple 2s cubic-bezier(0.25, 0, 0.75, 1) infinite;
  z-index: -1;
}

@keyframes ripple {
  0% { 
    transform: scale(1);
    opacity: 0.4;
  }
  100% { 
    transform: scale(1.3);
    opacity: 0;
  }
}

.music-icon-mini {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5a42e4, #4f46e5);
  z-index: 2;
  position: relative;
  box-shadow: 0 6px 15px rgba(90, 66, 228, 0.4);
  transition: all 0.3s ease;
}

.meting-glassui-player.playing .music-icon-mini {
  background: linear-gradient(135deg, #5a42e4, #4f46e5);
  box-shadow: 0 6px 15px rgba(90, 66, 228, 0.4);
}

.meting-glassui-player.loading .music-icon-mini {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 6px 15px rgba(245, 158, 11, 0.4);
}

/* 播放指示器动画 */
.now-playing-indicator {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: flex;
  align-items: flex-end;
  height: 15px;
  z-index: 3;
}

.now-playing-indicator span {
  display: inline-block;
  width: 3px;
  height: 3px;
  margin: 0 1px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 1px;
  animation: sound-wave 1.2s infinite ease;
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
}

.now-playing-indicator span:nth-child(1) {
  animation-delay: 0.2s;
}

.now-playing-indicator span:nth-child(2) {
  animation-delay: 0s;
  height: 8px;
}

.now-playing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes sound-wave {
  0% { height: 3px; }
  50% { height: 12px; }
  100% { height: 3px; }
}

/* 播放器控制图标 */
.play-icon-mini, .pause-icon-mini {
  position: relative;
  width: 14px;
  height: 16px;
}

/* ▶️ 播放图标 */
.play-icon-mini:before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 14px solid white;
  left: 0;
}

/* ⏸️ 暂停图标 */
.pause-icon-mini:before,
.pause-icon-mini:after {
  content: '';
  position: absolute;
  width: 4px;
  height: 14px;
  background: white;
  top: 1px;
  border-radius: 2px;
}

/* 添加间距 */
.pause-icon-mini:before {
  left: 2px;
}

.pause-icon-mini:after {
  left: 8px;
}

.loading-icon-mini:before {
  content: '';
  box-sizing: border-box;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin-top: -8px;
  margin-left: -8px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  animation: loading-spin 1s linear infinite;
}

@keyframes loading-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 全新音乐面板设计 */
.music-panel {
  position: absolute;
  width: 420px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-radius: 24px;
  box-shadow: 
    0 20px 50px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(90, 66, 228, 0.3) inset,
    0 0 30px rgba(90, 66, 228, 0.2);
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  z-index: 1000;
  bottom: 70px;
  transform-origin: bottom center;
  animation: panel-appear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  border: 1px solid rgba(90, 66, 228, 0.3);
}

@keyframes panel-appear {
  from { 
    transform: translateY(30px) scale(0.9); 
    opacity: 0;
  }
  to { 
    transform: translateY(0) scale(1); 
    opacity: 1;
  }
}

.meting-glassui-player.snap-left .music-panel {
  left: 0;
  right: auto;
  transform-origin: bottom left;
}

.meting-glassui-player.snap-right .music-panel {
  right: 0;
  left: auto;
  transform-origin: bottom right;
}

/* 面板头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  position: relative;
}

.panel-logo {
  font-size: 16px;
  font-weight: bold;
  background: linear-gradient(135deg, #5a42e4, #4f46e5);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 2px 10px rgba(90, 66, 228, 0.2);
}

.panel-buttons {
  display: flex;
  gap: 10px;
}

.panel-btn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.panel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
}

.panel-btn:active {
  transform: scale(0.95);
}

/* 当前播放 */
.now-playing {
  display: flex;
  padding: 0 20px 20px;
  gap: 20px;
}

.current-song-cover {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.current-song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.vinyl-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 35%;
  height: 35%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.8);
  transform: translate(-50%, -50%);
  z-index: 1;
  transition: all 0.3s ease;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
}

.vinyl-effect.rotating {
  animation: rotate 10s linear infinite;
}

@keyframes rotate {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.current-song-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-name {
  font-size: 18px;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 进度条 */
.progress-bar {
  position: relative;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-bottom: 15px;
  cursor: pointer;
}

.progress-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.progress-current {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #5a42e4, #4f46e5);
  box-shadow: 0 0 10px rgba(90, 66, 228, 0.5);
  transition: width 0.1s linear;
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 10px rgba(90, 66, 228, 0.5);
  transition: left 0.1s linear;
  z-index: 1;
}

.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
}

/* 播放控制 */
.player-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 15px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: rgba(255, 255, 255, 0.8);
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 1);
}

.play-btn {
  width: 50px;
  height: 50px;
  background: rgba(90, 66, 228, 0.8);
  color: white;
}

.play-btn:hover {
  background: rgba(90, 66, 228, 1);
  transform: scale(1.05);
}

.play-btn:active {
  transform: scale(0.95);
}

/* 音量控制 */
.volume-control {
  padding: 0 20px 15px;
  margin-top: -10px;
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.volume-slider {
  position: relative;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
}

.volume-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
}

.volume-current {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.6);
}

.volume-handle {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: white;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
}

/* 播放列表 */
.playlist-container {
  max-height: 300px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.2);
  animation: slide-up 0.3s ease;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.playlist-header {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.playlist-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.close-btn {
  background: transparent;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.playlist {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  max-height: 240px;
}

.playlist li {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.playlist li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.playlist li.active {
  background: rgba(90, 66, 228, 0.2);
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  margin-right: 15px;
  flex-shrink: 0;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-duration {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-left: 10px;
  white-space: nowrap;
}

/* 播放模式图标 */
.mode-list, .mode-random, .mode-single {
  position: relative;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-list:before, .mode-list:after {
  content: '';
  position: absolute;
  width: 16px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 10px;
}

.mode-list:after {
  width: 4px;
  height: 4px;
  border-width: 0;
  border-top: 2px solid rgba(255, 255, 255, 0.8);
  border-right: 2px solid rgba(255, 255, 255, 0.8);
  transform: rotate(45deg);
  left: 12px;
  top: 7px;
}

.mode-random:before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.8);
  clip-path: polygon(30% 65%, 10% 35%, 50% 10%, 90% 35%, 70% 65%, 50% 90%);
}

.mode-single:before {
  content: '1';
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  font-weight: bold;
}

/* 音量图标 */
.volume-high, .volume-low, .volume-mute {
  position: relative;
  width: 18px;
  height: 18px;
}

.volume-high:before, .volume-low:before, .volume-mute:before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 4px solid transparent;
  border-left: 8px solid rgba(255, 255, 255, 0.8);
  left: 1px;
  top: 5px;
}

.volume-high:after, .volume-low:after {
  content: '';
  position: absolute;
  top: 2px;
  left: 10px;
  width: 8px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-left: 0;
  border-radius: 0 14px 14px 0;
  box-sizing: border-box;
}

.volume-low:after {
  width: 5px;
  height: 10px;
  top: 4px;
  left: 10px;
}

.volume-mute:after {
  content: '';
  position: absolute;
  width: 10px;
  height: 2px;
  background: rgba(255, 255, 255, 0.8);
  transform: rotate(45deg);
  left: 6px;
  top: 8px;
}

/* 播放模式提示 */
.play-mode-tooltip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0;
  animation: tooltip-fade 2s ease;
}

@keyframes tooltip-fade {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

/* 移动端遮罩层 */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  animation: fade-in 0.3s ease;
}

/* 响应式样式 */
@media (max-width: 768px) {
  .meting-glassui-player {
    right: 15px;
    bottom: 70px;
  }
  
  .meting-glassui-player.snap-left {
    left: 15px;
    right: auto;
  }
  
  .music-ball {
    width: 50px;
    height: 50px;
  }
  
  .music-icon-mini {
    width: 30px;
    height: 30px;
  }
  
  .music-panel {
    width: calc(100vw - 30px);
    max-width: 380px;
    bottom: 60px;
  }
}

/* 吸附效果 */
.meting-glassui-player.snap-left {
  left: 20px;
  right: auto;
}

.meting-glassui-player.snap-right {
  right: 20px;
  left: auto;
}

/* 移动端优化样式 */
.meting-glassui-player.is-mobile .music-ball {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  box-shadow: 
    0 0 15px rgba(90, 66, 228, 0.4),
    0 0 30px rgba(90, 66, 228, 0.2),
    0 0 0 1px rgba(90, 66, 228, 0.3) inset;
}

.meting-glassui-player.is-mobile .music-icon-mini {
  width: 30px;
  height: 30px;
}

.meting-glassui-player.is-mobile .music-panel {
  width: calc(100vw - 30px);
  max-width: 340px;
  bottom: 60px;
  border-radius: 20px;
}

.meting-glassui-player.is-mobile .panel-btn {
  width: 36px;
  height: 36px;
}

.meting-glassui-player.is-mobile .current-song-cover {
  width: 60px;
  height: 60px;
}

.meting-glassui-player.is-mobile .playlist li {
  padding: 12px 15px;
}

.meting-glassui-player.is-mobile .song-name {
  font-size: 14px;
}

.meting-glassui-player.is-mobile .song-artist {
  font-size: 12px;
}

/* 优化移动端触摸反馈 */
.meting-glassui-player.is-mobile .music-ball:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

.meting-glassui-player.is-mobile .panel-btn:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

.meting-glassui-player.is-mobile .playlist li:active {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(0.98);
  transition: all 0.1s ease;
}

/* 移动端优化滚动条 */
.meting-glassui-player.is-mobile .playlist::-webkit-scrollbar {
  width: 4px;
}

.meting-glassui-player.is-mobile .playlist::-webkit-scrollbar-thumb {
  background: rgba(90, 66, 228, 0.3);
}

/* 移动端优化面板显示 */
@media (max-width: 768px) {
  .music-ball {
    width: 50px;
    height: 50px;
    border-radius: 25px;
  }
  
  .music-icon-mini {
    width: 30px;
    height: 30px;
  }
  
  .music-panel {
    position: fixed;
    width: 90%;
    max-width: 420px;
    max-height: 80vh;
    overflow-y: auto;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) !important;
    bottom: auto;
    margin: 0 auto;
    animation: mobile-panel-appear 0.3s ease;
  }
  
  @keyframes mobile-panel-appear {
    from { 
      transform: translate(-50%, -40%) scale(0.9) !important; 
      opacity: 0;
    }
    to { 
      transform: translate(-50%, -50%) scale(1) !important; 
      opacity: 1;
    }
  }
  
  .playlist {
    max-height: 40vh;
  }
  
  .meting-glassui-player.is-mobile .playlist {
    max-height: 35vh;
  }
  
  /* 确保按钮点击区域足够大 */
  .panel-btn {
    width: 44px;
    height: 44px;
  }
  
  .now-playing {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .current-song-cover {
    margin-bottom: 15px;
    width: 100px;
    height: 100px;
  }
  
  .current-song-info {
    width: 100%;
    text-align: center;
  }
}
</style> 