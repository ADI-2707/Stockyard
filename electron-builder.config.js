module.exports = {
  appId: 'com.stockyard.inventory',
  productName: 'Stockyard',
  directories: {
    output: 'dist-installer'
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'package.json'
  ],
  extraResources: [
    {
      from: 'drizzle/',
      to: 'drizzle'
    }
  ],
  win: {
    icon: 'build/stockyard_icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Stockyard'
  }
}
