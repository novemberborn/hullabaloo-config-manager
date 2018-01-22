'use strict'
const plugin = require('../node_modules/plugin')

module.exports = api => {
  const envName = api.env()
  return {
    plugins: [
      [plugin, {label: envName}],
      [plugin, {label: envName}, envName]
    ],
    env: {
      [envName]: {
        plugins: [
          [plugin, {label: `${envName}.env`}, envName]
        ]
      }
    }
  }
}
