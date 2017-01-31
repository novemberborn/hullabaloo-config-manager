import path from 'path'
import { runInNewContext } from 'vm'

import test from 'ava'

import { fromDirectory, fromVirtual } from '../'
import fixture from './helpers/fixture'

test('fromDirectory() resolves options, dependencies, and can generate code', async t => {
  const dir = fixture('compare')
  const result = await fromDirectory(dir)

  const configModule = {}
  runInNewContext(result.generateModule(), { exports: configModule })

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  t.deepEqual(configModule.withoutEnv('ava'), {
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
      ava: {
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

  t.deepEqual(configModule.byEnv.foo(), {
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
                  [`${dir}/node_modules/plugin/index.js`,
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

test('fromVirtual() resolves options, dependencies, and can generate code', async t => {
  const dir = fixture('compare')
  const source = fixture('compare', 'virtual.json')
  const result = await fromVirtual(require(source), source) // eslint-disable-line import/no-dynamic-require

  const configModule = {}
  runInNewContext(result.generateModule(), { exports: configModule })

  const pluginIndex = path.join(dir, 'node_modules', 'plugin', 'index.js')
  const presetIndex = path.join(dir, 'node_modules', 'preset', 'index.js')
  t.deepEqual(configModule.withoutEnv('ava'), {
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
      ava: {
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
          ava: {
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
              ava: {
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

  t.deepEqual(configModule.byEnv.foo(), {
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
                  [`${dir}/node_modules/plugin/index.js`,
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
