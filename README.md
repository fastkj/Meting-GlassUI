# Meting-GlassUI

[![npm](https://img.shields.io/npm/v/meting-glassui)](https://www.npmjs.com/package/meting-glassui)
[![GitHub](https://img.shields.io/github/license/fastkj/Meting-GlassUI)](https://github.com/fastkj/Meting-GlassUI/blob/main/LICENSE)

一个基于 Vue 3 的现代化玻璃风格音乐播放器，支持 Meting API，适用于 VitePress、Hexo 等博客系统。

![Meting-GlassUI 预览](https://github.com/fastkj/Meting-GlassUI/raw/main/screenshot.png)

## 特点

- 🎵 支持网易云音乐、QQ音乐、酷狗音乐等平台的歌单
- 💎 精美的玻璃态 UI 设计，支持暗色/亮色模式自适应
- 📱 响应式设计，完美支持移动端和桌面端
- 🔄 完整的播放控制：播放/暂停、上一首/下一首、进度控制、音量控制等
- 🌐 基于 Meting API，无需后端服务
- 📃 LRC 歌词滚动显示
- 🔌 易于集成到 VitePress、Vue 3 项目
- 🎨 支持自定义主题色、位置等

## 安装

```bash
npm install meting-glassui --save
# 或
yarn add meting-glassui
# 或
pnpm add meting-glassui
```

## 在 VitePress 中使用

1. 在 `.vitepress/theme/index.js` 中注册插件：

```js
import DefaultTheme from 'vitepress/theme'
import MetingGlassUI from 'meting-glassui'
import 'meting-glassui/dist/meting-glassui.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(MetingGlassUI, {
      config: {
        // 网易云音乐歌单ID
        id: '7361662884',
        // 音乐服务提供商，支持 'netease' (网易云), 'tencent' (QQ音乐), 'kugou' (酷狗)
        server: 'netease',
        // 初始音量
        volume: 0.7,
        // 是否自动播放
        autoplay: false,
        // 播放器主题色
        theme: '#5a42e4',
        // 播放模式: 'list', 'random', 'single'
        playMode: 'list'
      }
    })
  }
}
```

2. 在页面中使用悬浮播放器：

组件会自动以悬浮球的形式显示在页面右下角，无需额外添加代码。

3. 如需创建音乐专页，在 Markdown 文件中添加：

```md
---
layout: page
title: 音乐空间
---

<MetingGlassUI />
```

## 在 Vue 3 项目中使用

```js
// main.js
import { createApp } from 'vue'
import App from './App.vue'
import MetingGlassUI from 'meting-glassui'
import 'meting-glassui/dist/meting-glassui.css'

const app = createApp(App)

app.use(MetingGlassUI, {
  config: {
    // 网易云音乐歌单ID
    id: '7361662884',
    server: 'netease',
    volume: 0.7
  }
})

app.mount('#app')
```

## API 参考

### 配置选项

```typescript
interface PlayerConfig {
  // 是否启用音乐播放器
  enable: boolean;
  
  // 音乐服务提供商
  server: 'netease' | 'tencent' | 'kugou';
  
  // 播放列表 ID
  id: string;
  
  // 初始音量 (0-1)
  volume?: number;
  
  // 是否自动播放
  autoplay?: boolean;
  
  // 播放器主题色
  theme?: string;
  
  // 播放模式
  playMode?: 'list' | 'random' | 'single';
  
  // 自定义播放列表
  customPlaylist?: Song[];
  
  // 是否在移动端显示播放器
  showInMobile?: boolean;
  
  // 播放器默认位置
  defaultPosition?: 'left' | 'right';
  
  // 是否记住播放进度
  rememberProgress?: boolean;
  
  // 是否记住播放列表位置
  rememberPlaylist?: boolean;
  
  // 是否启用音乐页面
  enableMusicPage?: boolean;
  
  // 音乐页面路径
  musicPagePath?: string;
}
```

### 自定义播放列表

如果你不想使用在线音乐平台的歌单，可以提供自定义播放列表：

```js
app.use(MetingGlassUI, {
  config: {
    customPlaylist: [
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
      }
    ]
  }
})
```

### 全局方法

插件会在 Vue 实例上注册 `$metingGlassUI` 对象，提供以下方法：

```js
// 切换播放/暂停
this.$metingGlassUI.togglePlay()

// 下一首
this.$metingGlassUI.next()

// 上一首
this.$metingGlassUI.prev()

// 播放指定索引的歌曲
this.$metingGlassUI.playIndex(2)
```

## 许可证

[MIT](https://github.com/fastkj/Meting-GlassUI/blob/main/LICENSE) 