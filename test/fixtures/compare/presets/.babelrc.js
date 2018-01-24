module.exports = {
  extends: './subdir/base.json5',
  plugins: [
    ['module:plugin', {label: 'plugin'}]
  ],
  presets: [
    {
      plugins: [
        ['module:plugin', {label: 'preset->plugin'}]
      ],
      presets: [
        './preset.js',
        () => ({
          plugins: [
            ['module:plugin', {label: 'preset->preset->plugin'}]
          ],
          presets: [
            {
              plugins: [
                ['module:plugin', {label: 'preset->preset->preset->plugin'}]
              ]
            }
          ]
        })
      ]
    },
    {},
    './edge-cases.js'
  ]
}
