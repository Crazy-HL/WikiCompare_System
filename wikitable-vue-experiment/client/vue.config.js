const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://127.0.0.1:8888',
        changeOrigin: true,
      },
    },
  },
})
