import path from 'path'

import test from 'ava'
import proxyquire from 'proxyquire'

import { fromDirectory, fromVirtual, prepareCache } from '../'
import fixture from './helpers/fixture'
import runGeneratedCode from './helpers/runGeneratedCode'

function mockCurrentEnv (env = {}) {
  return proxyquire('../', {
    './lib/currentEnv': proxyquire('../lib/currentEnv', {
      process: {
        env
      }
    })
  }).currentEnv
}

test('currentEnv() returns BABEL_ENV, if set', t => {
  const currentEnv = mockCurrentEnv({
    BABEL_ENV: 'foo'
  })
  t.true(currentEnv() === 'foo')
})

test('currentEnv() returns NODE_ENV, if no BABEL_ENV', t => {
  const currentEnv = mockCurrentEnv({
    NODE_ENV: 'foo'
  })
  t.true(currentEnv() === 'foo')
})

test('currentEnv() falls back to "development", if no BABEL_ENV or NODE_ENV', t => {
  const currentEnv = mockCurrentEnv()
  t.true(currentEnv() === 'development')
})

test('fromDirectory() resolves options, dependencies, uses cache, and can generate code', async t => {
  const dir = fixture('compare')
  const cache = prepareCache()
  const result = await fromDirectory(dir, {cache})

  for (const file of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'extended-by-babelrc.json5'),
    fixture('compare', 'package.json')
  ]) {
    t.true(cache.files.has(file))
  }
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  t.deepEqual(configModule.getOptions(), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc'
        }
      ]
    ],
    presets: [
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc'
        }
      ]
    ],
    babelrc: false,
    sourceMaps: false,
    env: {
      development: {
        plugins: [
          [
            pluginIndex,
            {
              label: 'plugin@babelrc'
            }
          ]
        ],
        presets: [
          [
            presetIndex,
            {
              label: 'preset@babelrc'
            }
          ]
        ]
      }
    }
  })

  env.BABEL_ENV = 'foo'
  const envPluginIndex = path.join(dir, 'node_modules', 'env-plugin', 'index.js')
  t.deepEqual(configModule.getOptions(), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc'
        }
      ]
    ],
    presets: [
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc'
        }
      ]
    ],
    babelrc: false,
    sourceMaps: false,
    env: {
      foo: {
        plugins: [
          [
            pluginIndex,
            {
              label: 'plugin@extended-by-babelrc.foo'
            }
          ]
        ],
        presets: [
          [
            presetIndex,
            {
              label: 'preset@extended-by-babelrc.foo'
            }
          ]
        ],
        env: {
          foo: {
            plugins: [
              [
                pluginIndex,
                {
                  label: 'plugin@babelrc'
                }
              ]
            ],
            presets: [
              [
                presetIndex,
                {
                  label: 'preset@babelrc'
                }
              ]
            ],
            env: {
              foo: {
                plugins: [
                  [
                    envPluginIndex,
                    {
                      label: 'plugin@babelrc.foo'
                    }
                  ]
                ],
                presets: [
                  [
                    presetIndex,
                    {
                      label: 'preset@babelrc.foo'
                    }
                  ]
                ]
              }
            }
          }
        }
      }
    }
  })
})

test('fromDirectory() works without cache', t => {
  t.notThrows(fromDirectory(fixture('compare')))
})

test('fromVirtual() resolves options, dependencies, uses cache, and can generate code', async t => {
  const dir = fixture('compare')
  const cache = prepareCache()
  const source = fixture('compare', 'virtual.json')
  const result = await fromVirtual(require(source), source, {cache}) // eslint-disable-line import/no-dynamic-require

  for (const file of [
    fixture('compare', '.babelrc'),
    fixture('compare', 'extended-by-babelrc.json5'),
    fixture('compare', 'extended-by-virtual.json5'),
    fixture('compare', 'extended-by-virtual-foo.json5'),
    fixture('compare', 'package.json')
  ]) {
    t.true(cache.files.has(file))
  }
  t.true(cache.pluginsAndPresets.has(dir))

  const env = {}
  const configModule = runGeneratedCode(result.generateModule(), env)

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  const envPluginIndex = path.join(dir, 'node_modules', 'env-plugin', 'index.js')
  t.deepEqual(configModule.getOptions(), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc'
        }
      ]
    ],
    presets: [
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc'
        }
      ]
    ],
    babelrc: false,
    sourceMaps: true,
    env: {
      development: {
        plugins: [
          [
            pluginIndex,
            {
              label: 'plugin@babelrc'
            }
          ]
        ],
        presets: [
          [
            presetIndex,
            {
              label: 'preset@babelrc'
            }
          ]
        ],
        env: {
          development: {
            plugins: [
              [
                pluginIndex,
                {
                  label: 'plugin@extended-by-virtual'
                }
              ]
            ],
            presets: [
              [
                presetIndex,
                {
                  label: 'preset@extended-by-virtual'
                }
              ]
            ],
            env: {
              development: {
                plugins: [
                  [
                    pluginIndex,
                    {
                      label: 'plugin@virtual'
                    }
                  ]
                ],
                presets: [
                  [
                    presetIndex,
                    {
                      label: 'preset@virtual'
                    }
                  ]
                ]
              }
            }
          }
        }
      }
    }
  })

  env.BABEL_ENV = 'foo'
  t.deepEqual(configModule.getOptions(), {
    plugins: [
      [
        pluginIndex,
        {
          label: 'plugin@extended-by-babelrc'
        }
      ]
    ],
    presets: [
      [
        presetIndex,
        {
          label: 'preset@extended-by-babelrc'
        }
      ]
    ],
    babelrc: false,
    sourceMaps: true,
    env: {
      foo: {
        plugins: [
          [
            pluginIndex,
            {
              label: 'plugin@extended-by-babelrc.foo'
            }
          ]
        ],
        presets: [
          [
            presetIndex,
            {
              label: 'preset@extended-by-babelrc.foo'
            }
          ]
        ],
        env: {
          foo: {
            plugins: [
              [
                pluginIndex,
                {
                  label: 'plugin@babelrc'
                }
              ]
            ],
            presets: [
              [
                presetIndex,
                {
                  label: 'preset@babelrc'
                }
              ]
            ],
            env: {
              foo: {
                plugins: [
                  [
                    envPluginIndex,
                    {
                      label: 'plugin@babelrc.foo'
                    }
                  ]
                ],
                presets: [
                  [
                    presetIndex,
                    {
                      label: 'preset@babelrc.foo'
                    }
                  ]
                ],
                env: {
                  foo: {
                    plugins: [
                      [
                        pluginIndex,
                        {
                          label: 'plugin@extended-by-virtual'
                        }
                      ]
                    ],
                    presets: [
                      [
                        presetIndex,
                        {
                          label: 'preset@extended-by-virtual'
                        }
                      ]
                    ],
                    env: {
                      foo: {
                        plugins: [
                          [
                            pluginIndex,
                            {
                              label: 'plugin@extended-by-virtual.foo'
                            }
                          ]
                        ],
                        presets: [
                          [
                            presetIndex,
                            {
                              label: 'preset@extended-by-virtual.foo'
                            }
                          ]
                        ],
                        env: {
                          foo: {
                            plugins: [
                              [
                                pluginIndex,
                                {
                                  label: 'plugin@virtual'
                                }
                              ]
                            ],
                            presets: [
                              [
                                presetIndex,
                                {
                                  label: 'preset@virtual'
                                }
                              ]
                            ],
                            env: {
                              foo: {
                                plugins: [
                                  [
                                    pluginIndex,
                                    {
                                      label: 'plugin@extended-by-virtual-foo'
                                    }
                                  ]
                                ],
                                presets: [
                                  [
                                    presetIndex,
                                    {
                                      label: 'preset@extended-by-virtual-foo'
                                    }
                                  ]
                                ],
                                env: {
                                  foo: {
                                    plugins: [
                                      [
                                        pluginIndex,
                                        {
                                          label: 'plugin@virtual.foo'
                                        }
                                      ]
                                    ],
                                    presets: [
                                      [
                                        presetIndex,
                                        {
                                          label: 'preset@virtual.foo'
                                        }
                                      ]
                                    ]
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })
})

test('fromVirtual() works without cache', t => {
  const source = fixture('compare', 'virtual.json')
  t.notThrows(fromVirtual(require(source), source)) // eslint-disable-line import/no-dynamic-require
})

test('prepareCache()', t => {
  const cache = prepareCache()
  t.deepEqual(Object.keys(cache), ['dependencyHashes', 'fileExistence', 'files', 'pluginsAndPresets', 'sourceHashes'])
  t.true(cache.dependencyHashes instanceof Map)
  t.true(cache.fileExistence instanceof Map)
  t.true(cache.files instanceof Map)
  t.true(cache.pluginsAndPresets instanceof Map)
  t.true(cache.sourceHashes instanceof Map)
})
