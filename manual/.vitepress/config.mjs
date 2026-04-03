import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'クレー射撃 成績管理システム',
  description: '操作マニュアル',
  base: '/manual/',
  outDir: '../public/manual',
  lang: 'ja',
  themeConfig: {
    nav: [
      { text: 'はじめに', link: '/' },
      { text: '選手・閲覧者向け', link: '/viewer/scores' },
      { text: '大会管理者向け', link: '/admin/create' },
      { text: 'システム管理者向け', link: '/system/admins' },
    ],
    sidebar: [
      {
        text: 'はじめに',
        link: '/',
      },
      {
        text: '選手・閲覧者向け',
        items: [
          { text: '成績を見る', link: '/viewer/scores' },
        ],
      },
      {
        text: '大会管理者向け',
        items: [
          { text: '大会を作成する', link: '/admin/create' },
          { text: '申込を管理する', link: '/admin/registrations' },
          { text: '選手を登録する', link: '/admin/members' },
          { text: '成績を入力する', link: '/admin/scores' },
          { text: '結果を公開する', link: '/admin/results' },
        ],
      },
      {
        text: 'システム管理者向け',
        items: [
          { text: '管理者アカウントを管理する', link: '/system/admins' },
          { text: '協会マスターを管理する', link: '/system/associations' },
          { text: '射撃場マスターを管理する', link: '/system/ranges' },
          { text: 'Q&Aを管理する', link: '/system/qa' },
        ],
      },
    ],
    socialLinks: [],
    footer: {
      message: 'クレー射撃 成績管理システム 操作マニュアル',
    },
    search: {
      provider: 'local',
    },
    outline: {
      label: 'このページの内容',
    },
    docFooter: {
      prev: '前のページ',
      next: '次のページ',
    },
    darkModeSwitchLabel: 'テーマ',
    sidebarMenuLabel: 'メニュー',
    returnToTopLabel: 'トップに戻る',
  },
})
