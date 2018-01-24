module.exports = () => ({
  plugins: [
    ['module:plugin', {label: 'preset.js->preset->plugin'}]
  ],
  presets: [
    {
      plugins: [
        ['module:plugin', {label: 'preset.js->preset->preset->plugin'}]
      ]
    }
  ]
})
