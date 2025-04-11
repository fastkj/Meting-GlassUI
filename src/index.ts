import { App, Plugin } from 'vue';
import MusicPlayer from './components/MusicPlayer.vue';
import type { PlayerConfig } from './types';

// 默认配置
const defaultConfig: PlayerConfig = {
  enable: true,
  server: 'netease',
  id: '',
  volume: 0.7,
  autoplay: false,
  theme: '#5a42e4',
  playMode: 'list',
  showInMobile: true,
  defaultPosition: 'right',
  rememberProgress: true,
  rememberPlaylist: true,
  enableMusicPage: true,
  musicPagePath: '/music/'
};

// 插件选项接口
export interface MetingGlassUIOptions {
  config?: Partial<PlayerConfig>;
  musicPagePath?: string;
}

// 创建插件
const MetingGlassUIPlugin: Plugin = {
  install(app: App, options: MetingGlassUIOptions = {}) {
    // 合并默认配置和用户配置
    const config: PlayerConfig = {
      ...defaultConfig,
      ...options.config,
    };
    
    // 如果没有提供ID，则插件禁用
    if (!config.id && !config.customPlaylist) {
      console.warn('[Meting-GlassUI] 未提供播放列表ID或自定义播放列表，插件已禁用');
      config.enable = false;
    }
    
    // 注册全局组件
    app.component('MetingGlassUI', MusicPlayer);
    
    // 提供全局配置
    app.provide('metingGlassUIConfig', config);
    
    // 添加全局属性
    app.config.globalProperties.$metingGlassUI = {
      config,
      
      // 添加一些可以从外部调用的方法
      togglePlay: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('meting-glassui-toggle-play'));
        }
      },
      
      next: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('meting-glassui-next'));
        }
      },
      
      prev: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('meting-glassui-prev'));
        }
      },
      
      playIndex: (index: number) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('meting-glassui-play-index', { detail: { index } }));
        }
      }
    };
  }
};

// 导出类型
export type { PlayerConfig, Song, PlayerState, PlayerInstanceMethods } from './types';

// 导出组件
export { MusicPlayer };

// 默认导出插件
export default MetingGlassUIPlugin; 