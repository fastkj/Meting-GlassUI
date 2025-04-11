export interface Song {
  name: string;
  artist: string;
  url: string;
  cover: string;
  lrc?: string;
}

export interface PlayerConfig {
  /**
   * 是否启用音乐播放器
   * @default true
   */
  enable: boolean;
  
  /**
   * 音乐服务提供商，支持 netease (网易云音乐)、tencent (QQ音乐)、kugou (酷狗音乐)
   * @default 'netease'
   */
  server: 'netease' | 'tencent' | 'kugou';
  
  /**
   * 播放列表 ID
   */
  id: string;
  
  /**
   * 初始音量 (0-1)
   * @default 0.7
   */
  volume?: number;
  
  /**
   * 是否自动播放
   * @default false
   */
  autoplay?: boolean;
  
  /**
   * 播放器主题色
   * @default '#5a42e4'
   */
  theme?: string;
  
  /**
   * 播放模式: 'list' - 列表循环, 'random' - 随机播放, 'single' - 单曲循环
   * @default 'list'
   */
  playMode?: 'list' | 'random' | 'single';
  
  /**
   * 自定义播放列表
   */
  customPlaylist?: Song[];
  
  /**
   * 是否在移动端显示播放器
   * @default true
   */
  showInMobile?: boolean;
  
  /**
   * 播放器默认位置
   * @default 'right'
   */
  defaultPosition?: 'left' | 'right';
  
  /**
   * 是否记住播放进度
   * @default true
   */
  rememberProgress?: boolean;
  
  /**
   * 是否记住播放列表位置
   * @default true
   */
  rememberPlaylist?: boolean;
  
  /**
   * 是否启用音乐页面
   * @default true
   */
  enableMusicPage?: boolean;
  
  /**
   * 音乐页面路径
   * @default '/music/'
   */
  musicPagePath?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentIndex: number;
  currentSong: Song | null;
  playlist: Song[];
  currentTime: number;
  duration: number;
  volume: number;
}

export interface PlayerInstanceMethods {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  playIndex: (index: number) => void;
  setPlaylist: (list: Song[]) => void;
} 