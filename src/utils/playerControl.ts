import { ref, reactive, Ref, computed, ComputedRef } from 'vue';
import type { Song, PlayerConfig, PlayerState, PlayerInstanceMethods } from '../types';

/**
 * 默认播放列表（用于API加载失败的备选项）
 */
const DEFAULT_PLAYLIST: Song[] = [
  {
    name: "告白气球",
    artist: "周杰伦",
    url: "https://music.163.com/song/media/outer/url?id=1846489646.mp3",
    cover: "https://p2.music.126.net/JI5LD9bISJzX5F0qSgHkHQ==/109951166361039007.jpg",
    lrc: "https://cdn.moefe.org/lyric/tell.lrc"
  },
  {
    name: "不将就",
    artist: "李荣浩",
    url: "https://music.163.com/song/media/outer/url?id=31654343.mp3",
    cover: "https://p2.music.126.net/k_WRxDY4C2kgGmKiCOs0vA==/7869002766674348.jpg",
    lrc: ""
  },
  {
    name: "起风了",
    artist: "买辣椒也用券",
    url: "https://music.163.com/song/media/outer/url?id=1330348068.mp3",
    cover: "https://p1.music.126.net/diGAyEmpymX8G7JcnElncQ==/109951163699673355.jpg",
    lrc: "https://cdn.moefe.org/lyric/qifengle.lrc"
  }
];

// 存储全局播放器实例
let globalAudio: HTMLAudioElement | null = null;

/**
 * 创建一个播放器实例
 */
export function usePlayer(config: PlayerConfig) {
  // 播放器核心状态
  const isPlaying = ref(false);
  const isMuted = ref(false);
  const volume = ref(config.volume ?? 0.7);
  const currentTime = ref(0);
  const duration = ref(0);
  const currentIndex = ref(0);
  const playlist = ref<Song[]>([]);
  const currentLyricIndex = ref(-1);
  const parsedLyrics = ref<{ time: number, text: string }[]>([]);
  const isLoading = ref(true);
  const playMode = ref(config.playMode || 'list');
  
  // 计算属性
  const currentSong: ComputedRef<Song | null> = computed(() => {
    if (playlist.value.length === 0) return null;
    return playlist.value[currentIndex.value];
  });
  
  // 播放器实例
  const audio = ref<HTMLAudioElement | null>(null);
  
  // 初始化播放器
  function init() {
    // 如果已经有全局播放器实例，使用该实例
    if (globalAudio) {
      audio.value = globalAudio;
      
      // 同步当前状态
      isPlaying.value = !audio.value.paused;
      volume.value = audio.value.volume;
      currentTime.value = audio.value.currentTime;
      duration.value = audio.value.duration || 0;
      
      // 设置事件监听器
      setupEventListeners();
      
      // 尝试加载播放列表
      if (config.customPlaylist && config.customPlaylist.length > 0) {
        playlist.value = config.customPlaylist;
        isLoading.value = false;
      } else {
        fetchPlaylist();
      }
      
      return;
    }
    
    // 创建新的音频播放器实例
    audio.value = new Audio();
    globalAudio = audio.value;
    
    // 设置初始音量
    audio.value.volume = volume.value;
    
    // 设置事件监听器
    setupEventListeners();
    
    // 加载播放列表
    if (config.customPlaylist && config.customPlaylist.length > 0) {
      playlist.value = config.customPlaylist;
      isLoading.value = false;
      
      // 加载第一首歌
      if (playlist.value.length > 0) {
        loadSong();
      }
    } else {
      fetchPlaylist();
    }
  }
  
  // 设置事件监听器
  function setupEventListeners() {
    if (!audio.value) return;
    
    // 清除现有事件监听器
    const currentAudio = audio.value;
    currentAudio.removeEventListener('play', onPlay);
    currentAudio.removeEventListener('pause', onPause);
    currentAudio.removeEventListener('timeupdate', onTimeUpdate);
    currentAudio.removeEventListener('ended', onEnded);
    currentAudio.removeEventListener('error', onError);
    currentAudio.removeEventListener('loadedmetadata', onLoadedMetadata);
    
    // 添加新的事件监听器
    currentAudio.addEventListener('play', onPlay);
    currentAudio.addEventListener('pause', onPause);
    currentAudio.addEventListener('timeupdate', onTimeUpdate);
    currentAudio.addEventListener('ended', onEnded);
    currentAudio.addEventListener('error', onError);
    currentAudio.addEventListener('loadedmetadata', onLoadedMetadata);
  }
  
  // 事件处理函数
  function onPlay() {
    isPlaying.value = true;
    notifyStateChange();
  }
  
  function onPause() {
    isPlaying.value = false;
    notifyStateChange();
  }
  
  function onTimeUpdate() {
    if (!audio.value) return;
    currentTime.value = audio.value.currentTime;
    
    // 通知时间更新
    notifyTimeUpdate();
    
    // 更新歌词位置
    updateCurrentLyric();
  }
  
  function onEnded() {
    // 根据播放模式决定下一步操作
    if (playMode.value === 'single') {
      // 单曲循环
      if (audio.value) {
        audio.value.currentTime = 0;
        audio.value.play().catch(err => console.error('播放失败', err));
      }
    } else {
      // 播放下一首
      nextSong();
    }
  }
  
  function onError(e: Event) {
    console.error('音频播放错误:', e);
    nextSong(); // 出错时自动跳到下一首
  }
  
  function onLoadedMetadata() {
    if (!audio.value) return;
    duration.value = audio.value.duration;
  }
  
  // 播放控制
  function play() {
    if (!audio.value || !currentSong.value) return;
    
    audio.value.play().catch(err => {
      console.error('播放失败', err);
    });
  }
  
  function pause() {
    if (!audio.value) return;
    audio.value.pause();
  }
  
  function toggle() {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }
  
  function nextSong() {
    if (playlist.value.length === 0) return;
    
    if (playMode.value === 'random') {
      // 随机播放
      const randomIndex = Math.floor(Math.random() * playlist.value.length);
      currentIndex.value = randomIndex;
    } else {
      // 列表循环
      currentIndex.value = (currentIndex.value + 1) % playlist.value.length;
    }
    
    loadSong();
  }
  
  function prevSong() {
    if (playlist.value.length === 0) return;
    
    if (playMode.value === 'random') {
      // 随机播放
      const randomIndex = Math.floor(Math.random() * playlist.value.length);
      currentIndex.value = randomIndex;
    } else {
      // 列表循环
      currentIndex.value = (currentIndex.value - 1 + playlist.value.length) % playlist.value.length;
    }
    
    loadSong();
  }
  
  function loadSong() {
    if (!audio.value || !currentSong.value) return;
    
    // 设置新音频源
    audio.value.src = currentSong.value.url;
    audio.value.load();
    
    // 重置状态
    currentTime.value = 0;
    duration.value = 0;
    
    // 如果配置了自动播放，则开始播放
    if (config.autoplay) {
      play();
    }
    
    // 加载歌词
    if (currentSong.value.lrc) {
      loadLyrics(currentSong.value.lrc);
    } else {
      parsedLyrics.value = [];
    }
    
    // 通知播放列表切换
    notifyListSwitch();
  }
  
  function seek(time: number) {
    if (!audio.value) return;
    
    if (time < 0) time = 0;
    if (time > duration.value) time = duration.value;
    
    audio.value.currentTime = time;
  }
  
  function setVolume(vol: number) {
    if (!audio.value) return;
    
    if (vol < 0) vol = 0;
    if (vol > 1) vol = 1;
    
    volume.value = vol;
    audio.value.volume = vol;
  }
  
  function playIndex(index: number) {
    if (index < 0 || index >= playlist.value.length) return;
    
    currentIndex.value = index;
    loadSong();
    play();
  }
  
  // 外部传入播放列表
  function setPlaylist(list: Song[]) {
    if (!list || list.length === 0) return;
    
    playlist.value = list;
    
    // 如果当前索引超出新播放列表范围，重置为0
    if (currentIndex.value >= playlist.value.length) {
      currentIndex.value = 0;
    }
    
    loadSong();
  }
  
  // 获取播放列表
  async function fetchPlaylist() {
    isLoading.value = true;
    
    if (!config.enable || !config.id) {
      console.warn('音乐播放器未配置或未启用');
      isLoading.value = false;
      return;
    }
    
    const server = config.server || 'netease';
    const id = config.id;
    
    try {
      // 使用Meting API获取歌单
      const api = `https://api.i-meto.com/meting/api?server=${server}&type=playlist&id=${id}`;
      const response = await fetch(api);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        playlist.value = data.map(item => ({
          name: item.title || item.name || '未知歌曲',
          artist: item.author || item.artist || '未知艺术家',
          url: item.url || '',
          cover: item.pic || item.cover || '',
          lrc: item.lrc || ''
        }));
        
        // 加载第一首歌
        currentIndex.value = 0;
        loadSong();
      } else {
        useFallbackPlaylist();
      }
    } catch (error) {
      console.error('获取播放列表失败:', error);
      useFallbackPlaylist();
    } finally {
      isLoading.value = false;
    }
  }
  
  // 使用备选播放列表
  function useFallbackPlaylist() {
    playlist.value = DEFAULT_PLAYLIST;
    
    // 加载第一首歌
    currentIndex.value = 0;
    loadSong();
  }
  
  // 加载歌词
  async function loadLyrics(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`获取歌词失败: ${response.status}`);
      }
      
      const lrcText = await response.text();
      parsedLyrics.value = parseLRC(lrcText);
    } catch (error) {
      console.error('加载歌词失败:', error);
      parsedLyrics.value = [];
    }
  }
  
  // 解析LRC歌词
  function parseLRC(lrc: string) {
    const lines = lrc.split('\n');
    const result: { time: number, text: string }[] = [];
    
    lines.forEach(line => {
      // 匹配时间标签 [00:00.00]
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
      const textContent = line.replace(timeRegex, '').trim();
      
      // 跳过空行或无内容行
      if (!textContent) return;
      
      let match;
      // 一行可能有多个时间标签
      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3], 10);
        
        // 转换为秒
        const time = minutes * 60 + seconds + milliseconds / 1000;
        
        result.push({
          time,
          text: textContent
        });
      }
    });
    
    // 按时间排序
    return result.sort((a, b) => a.time - b.time);
  }
  
  // 更新当前歌词
  function updateCurrentLyric() {
    if (parsedLyrics.value.length === 0) return;
    
    const time = currentTime.value;
    let index = -1;
    
    // 查找当前时间对应的歌词
    for (let i = 0; i < parsedLyrics.value.length; i++) {
      if (time >= parsedLyrics.value[i].time) {
        index = i;
      } else {
        break;
      }
    }
    
    currentLyricIndex.value = index;
  }
  
  // 事件通知相关
  function notifyStateChange() {
    if (typeof window === 'undefined') return;
    
    window.dispatchEvent(new CustomEvent('music-player-state-change', { 
      detail: { 
        isPlaying: isPlaying.value,
        currentIndex: currentIndex.value
      } 
    }));
  }
  
  function notifyListSwitch() {
    if (typeof window === 'undefined') return;
    
    window.dispatchEvent(new CustomEvent('music-player-list-switch', { 
      detail: { 
        index: currentIndex.value,
        song: currentSong.value
      } 
    }));
  }
  
  function notifyTimeUpdate() {
    if (typeof window === 'undefined') return;
    
    window.dispatchEvent(new CustomEvent('music-player-time-update', { 
      detail: { 
        currentTime: currentTime.value,
        duration: duration.value
      } 
    }));
  }
  
  // 导出播放器状态
  const playerState: PlayerState = reactive({
    isPlaying: isPlaying.value,
    currentIndex: currentIndex.value,
    currentSong: currentSong.value,
    playlist: playlist.value,
    currentTime: currentTime.value,
    duration: duration.value,
    volume: volume.value
  });
  
  // 同步响应式状态到导出对象
  watch(isPlaying, val => { playerState.isPlaying = val });
  watch(currentIndex, val => { playerState.currentIndex = val });
  watch(currentSong, val => { playerState.currentSong = val });
  watch(playlist, val => { playerState.playlist = val });
  watch(currentTime, val => { playerState.currentTime = val });
  watch(duration, val => { playerState.duration = val });
  watch(volume, val => { playerState.volume = val });
  
  // 导出方法
  const methods: PlayerInstanceMethods = {
    play,
    pause,
    toggle,
    next: nextSong,
    prev: prevSong,
    seek,
    setVolume,
    playIndex,
    setPlaylist
  };
  
  // 初始化播放器
  init();
  
  return {
    // 状态
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    currentIndex,
    playlist,
    currentSong,
    currentLyricIndex,
    parsedLyrics,
    isLoading,
    playMode,
    
    // 方法
    play,
    pause,
    toggle,
    next: nextSong,
    prev: prevSong,
    seek,
    setVolume,
    playIndex,
    setPlaylist,
    
    // 统一导出
    playerState,
    methods
  };
} 