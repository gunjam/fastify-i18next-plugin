const { deepEqual, equal, match, ok, rejects } = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const fastify = require('fastify')
const cookiePlugin = require('@fastify/cookie')
const acceptsPlugin = require('@fastify/accepts')
const sessionPlugin = require('@fastify/session')
const split = require('split2')
const plugin = require('../index.js')

test('error if opts.loadPath is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    loadPath: 0,
    languages: ['en']
  }), {
    message: 'opts.loadPath must be a string path'
  })
})

test('error if opts.languages is not an array of strings', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {}), {
    message: 'opts.languages must be an array of strings'
  })
  await rejects(async () => app.register(plugin, {
    dir: './fixtures/{{lng}}.{{ns}}.json',
    languages: ['en', 12]
  }), {
    message: 'opts.languages must be an array of strings'
  })
})

test('error if opts.languages is empty', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, { languages: [] }), {
    message: 'opts.languages must have at least one language'
  })
})

test('error if opts.fallbackLng is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    fallbackLng: false
  }), {
    message: 'opts.fallbackLng must be a string language code'
  })
})

test('error if opts.fallbackLng is not a a supported language', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    fallbackLng: 'it'
  }), {
    message: 'opts.fallbackLng must be a language code included in opts.languages'
  })
})

test('error if opts.decorateLocals is not a boolean', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    decorateLocals: 9
  }), {
    message: 'opts.decorateLocals must be a boolean'
  })
})

test('error if opts.queryKey is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    queryKey: 9
  }), {
    message: 'opts.queryKey must be a string'
  })
})

test('error if opts.param is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    param: 9
  }), {
    message: 'opts.param must be a string'
  })
})

test('error if opts.cookieName is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    cookieName: 9
  }), {
    message: 'opts.cookieName must be a string'
  })
})

test('error if opts.sessionKey is not a string', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    sessionKey: 9
  }), {
    message: 'opts.sessionKey must be a string'
  })
})

test('error if opts.languageDetectors is not an array of strings', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    languageDetectors: [true]
  }), {
    message: 'opts.languageDetectors must be an array of strings'
  })
})

test('error if opts.languageDetectors contains unsupported detectors', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    languageDetectors: ['fail']
  }), {
    message: 'opts.languageDetectors can only include "accept", "cookie", "param", "query" and "session"'
  })
})

test('error if opts.languageDetectors contains "accept" and @fastify/accepts is not loaded', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    languageDetectors: ['accept']
  }), {
    message: 'The @fastify/accepts plugin must be registered to use the "accept" detector'
  })
})

test('error if opts.languageDetectors contains "cookie" and @fastify/cookie is not loaded', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    languageDetectors: ['cookie']
  }), {
    message: 'The @fastify/cookie plugin must be registered to use the "cookie" detector'
  })
})

test('error if opts.languageDetectors contains "session" and @fastify/session is not loaded', async () => {
  const app = fastify()
  await rejects(async () => app.register(plugin, {
    languages: ['en'],
    languageDetectors: ['session']
  }), {
    message: 'The @fastify/session plugin must be registered to use the "session" detector'
  })
})

test('decorate server with addI18nResource function', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en']
  })

  ok(app.hasDecorator('addI18nResource'))
  equal(typeof app.addI18nResource, 'function')
})

test('decorate server with t function', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en']
  })

  ok(app.hasDecorator('t'))
  equal(typeof app.t, 'function')
})

test('decorate server with addI18nFormatter function', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en']
  })

  ok(app.hasDecorator('addI18nFormatter'))
  equal(typeof app.addI18nFormatter, 'function')
})

test('decorate server with addI18nCachedFormatter function', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en']
  })

  ok(app.hasDecorator('addI18nCachedFormatter'))
  equal(typeof app.addI18nCachedFormatter, 'function')
})

test('pass resources in options and get translations', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en', 'it'],
    resources: {
      en: {
        messages: {
          hello: 'Hello!'
        }
      },
      it: {
        messages: {
          hello: 'Ciao!'
        }
      }
    }
  })

  equal(app.t('messages:hello', 'en'), 'Hello!')
  equal(app.t('messages:hello', 'it'), 'Ciao!')
})

test('app.t() passes translation options', async () => {
  const app = fastify()
  await app.register(plugin, {
    fallbackLng: 'en',
    languages: ['ar', 'en'],
    resources: {
      en: {
        messages: {
          hello: 'Hello {{name}}!'
        }
      }
    }
  })

  equal(app.t('messages:hello', 'it', { name: 'Niall' }), 'Hello Niall!')
})

test('app.t() uses fallback language if requested language is not available', async () => {
  const app = fastify()
  await app.register(plugin, {
    fallbackLng: 'en',
    languages: ['ar', 'en'],
    resources: {
      en: {
        messages: {
          hello: 'Hello!'
        }
      }
    }
  })

  equal(app.t('messages:hello', 'it'), 'Hello!')
})

test('app.t() uses first language in languages if no fallback', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en', 'it'],
    resources: {
      en: {
        messages: {
          hello: 'Hello!'
        }
      },
      it: {
        messages: {
          hello: 'Ciao!'
        }
      }
    }
  })

  equal(app.t('messages:hello', 'ar'), 'Hello!')
})

test('add resouces with app.addI18nResource()', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en', 'it']
  })

  app.addI18nResource('en', 'messages', { hello: 'Hello!' })
  app.addI18nResource('it', 'messages', { hello: 'Ciao!' })

  equal(app.t('messages:hello', 'en'), 'Hello!')
  equal(app.t('messages:hello', 'it'), 'Ciao!')
})

test('load resources from disk with opts.loadPath and get translations (ns and lng in filename)', async () => {
  const app = fastify()
  await app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    languages: ['en', 'it']
  })

  equal(app.t('messages:hello', 'en'), 'Hello!')
  equal(app.t('messages:hello', 'it'), 'Ciao!')
})

test('load resources from disk with opts.loadPath and get translations (ns and lng in path)', async () => {
  const app = fastify()
  await app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}/{{ns}}/translations.json'),
    languages: ['en']
  })

  equal(app.t('messages:goodbye', 'en'), 'Goodbye!')
})

test('load resources from disk with opts.loadPath, do not error on non-parsable files, but log', async () => {
  const logLines = []
  const app = fastify({
    logger: {
      stream: split((data) => {
        logLines.push(JSON.parse(data))
      })
    }
  })
  await app.register(plugin, {
    loadPath: join(__dirname, './fixtures/broken/{{lng}}.{{ns}}.json'),
    languages: ['en', 'it']
  })

  equal(app.t('messages:hello', 'en'), 'hello') // The key, message not loaded
  equal(app.t('messages:hello', 'it'), 'Ciao!')

  // Log warning that file could not be loaded
  const file = join(__dirname, './fixtures/broken/en.messages.json')
  equal(logLines.length, 1)
  equal(logLines[0].msg, `[fastify-i18next-plugin] failed to load resource ${file}`)
  equal(logLines[0].level, 50) // warn log level
  match(logLines[0].err.message, /Unexpected token 'N', "Not valid JSON\r?\n" is not valid JSON/)
})

test('load resources from disk use app.loadI18nResources()', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en', 'it']
  })

  await app.loadI18nResources(
    join(__dirname, './fixtures/{{lng}}.{{ns}}.json')
  )

  equal(app.t('messages:hello', 'en'), 'Hello!')
  equal(app.t('messages:hello', 'it'), 'Ciao!')
})

test('add formatter with app.addI18nFormatter()', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en', 'it'],
    resources: {
      en: {
        messages: {
          hello: 'Hello {{ name, upper }}!'
        }
      }
    }
  })

  app.addI18nFormatter('upper', (val) => val.toUpperCase())

  equal(app.t('messages:hello', 'en', { name: 'Niall' }), 'Hello NIALL!')
})

test('add formatter with app.addI18nCachedFormatter()', async () => {
  const app = fastify()
  await app.register(plugin, {
    languages: ['en'],
    resources: {
      en: {
        messages: {
          hello: 'Hello {{ name, listy }}!'
        }
      }
    }
  })

  app.addI18nCachedFormatter('listy', (lng) => {
    const formatter = new Intl.ListFormat(lng, {
      style: 'long',
      type: 'conjunction',
    })
    return (val) => formatter.format(val)
  })

  equal(app.t('messages:hello', 'en', { name: ['Niall', 'James', 'Tim'] }), 'Hello Niall, James, and Tim!')
})

test('set request.lng to first specific language if no fallback', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['en', 'it']
  })

  app.get('/', (request, reply) => {
    return request.lng
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'en')
})

test('set request.lng to fallback language', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['en', 'it'],
    fallbackLng: 'it'
  })

  app.get('/', (request, reply) => {
    return request.lng
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'it')
})

test('set request.lngs to supported languages', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['en', 'it']
  })

  app.get('/', (request, reply) => {
    return request.lngs
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, '["en","it"]')
})

test('set request.lngDir to direction of current language (ltr)', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['en']
  })

  app.get('/', (request, reply) => {
    return request.lngDir
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'ltr')
})

test('set request.lngDir to direction of current language (rtl)', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['ar']
  })

  app.get('/', (request, reply) => {
    return request.lngDir
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'rtl')
})

test('set request.t to get messages', async () => {
  const app = fastify()
  app.register(plugin, {
    languages: ['en'],
    resources: {
      en: {
        messages: { hello: 'Hello!' }
      }
    }
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'Hello!')
})

test('use request.setLanguage() to change language', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    languages: ['en', 'ar']
  })

  app.get('/', (request, reply) => {
    const en = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }

    // Change language to Arabic, request methods should return
    // different values
    request.setLanguage('ar')
    const ar = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }
    return { en, ar }
  })

  const res = await app.inject({ path: '/' })
  deepEqual(res.json(), {
    en: {
      msg: 'Hello!',
      lng: 'en',
      lngDir: 'ltr',
    },
    ar: {
      msg: 'مرحبًا',
      lng: 'ar',
      lngDir: 'rtl',
    }
  })
})

test('use fallback if calling request.setLanguage() with unsupported language', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en']
  })

  app.get('/', (request, reply) => {
    const en = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }

    // ar not loaded
    request.setLanguage('ar')
    const ar = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }
    return { en, ar }
  })

  const res = await app.inject({ path: '/' })
  deepEqual(res.json(), {
    en: {
      msg: 'Hello!',
      lng: 'en',
      lngDir: 'ltr',
    },
    ar: {
      msg: 'Hello!',
      lng: 'en',
      lngDir: 'ltr',
    }
  })
})

test('use first language if calling request.setLanguage() with unsupported language and there is no fallback', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    languages: ['en', 'it']
  })

  app.get('/', (request, reply) => {
    const en = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }

    // ar not loaded
    request.setLanguage('ar')
    const ar = {
      msg: request.t('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
    }
    return { en, ar }
  })

  const res = await app.inject({ path: '/' })
  deepEqual(res.json(), {
    en: {
      msg: 'Hello!',
      lng: 'en',
      lngDir: 'ltr',
    },
    ar: {
      msg: 'Hello!',
      lng: 'en',
      lngDir: 'ltr',
    }
  })
})

test('use request.i18nKeyExists() to check for a locale key', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    languages: ['en']
  })

  app.get('/', (request, reply) => {
    return {
      hasHello: request.i18nKeyExists('messages:hello'),
      hasGoodbye: request.i18nKeyExists('messages:goodbye')
    }
  })

  const res = await app.inject({ path: '/' })
  deepEqual(res.json(), {
    hasHello: true,
    hasGoodbye: false,
  })
})

test('detect language from lng path parameter', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['param']
  })

  app.get('/:lng', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/it' })
  equal(res.payload, 'Ciao!')
})

test('detect language from path parameter with custom name', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['param'],
    param: 'language'
  })

  app.get('/:language', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/it' })
  equal(res.payload, 'Ciao!')
})

test('detect language from lng query', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['query']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/?lng=it' })
  equal(res.payload, 'Ciao!')
})

test('detect language from query with custom name', async () => {
  const app = fastify()
  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['query'],
    queryKey: 'language'
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/?language=it' })
  equal(res.payload, 'Ciao!')
})

test('detect language from lng cookie', async () => {
  const app = fastify()
  app.register(cookiePlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['cookie']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({
    path: '/',
    cookies: {
      lng: 'it'
    }
  })
  equal(res.payload, 'Ciao!')
})

test('detect language from cookie with custom name', async () => {
  const app = fastify()
  app.register(cookiePlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['cookie'],
    cookieName: 'language'
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({
    path: '/',
    cookies: {
      language: 'it'
    }
  })
  equal(res.payload, 'Ciao!')
})

test('set language cookie with default options', async () => {
  const app = fastify()
  app.register(cookiePlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['cookie']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'Hello!')
  deepEqual(res.cookies, [
    {
      httpOnly: true,
      name: 'lng',
      path: '/',
      sameSite: 'Strict',
      value: 'en'
    }
  ])
})

test('set language cookie with custom options', async () => {
  const app = fastify()
  app.register(cookiePlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['cookie'],
    cookieOpts: {
      httpOnly: false,
      sameSite: 'Lax'
    }
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'Hello!')
  deepEqual(res.cookies, [
    {
      name: 'lng',
      sameSite: 'Lax',
      value: 'en'
    }
  ])
})

test('detect language from accept header', async () => {
  const app = fastify()
  app.register(acceptsPlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['accept']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({
    path: '/',
    headers: {
      // Accepts English and Italian but Italian is higher priority (0.9) so
      // should be selected
      'Accept-Language': 'it;q=0.9, en;q=0.5'
    }
  })
  equal(res.payload, 'Ciao!')
})

test('detect language from lng session key', async () => {
  const app = fastify()
  app.register(cookiePlugin)
  app.register(sessionPlugin, { secret: 'a secret with minimum length of 32 characters' })

  app.addHook('onRequest', (request, reply, done) => {
    request.session.lng = 'it'
    done()
  })

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['session']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'Ciao!')
})

test('detect language from custom session key', async () => {
  const app = fastify()
  app.register(cookiePlugin)
  app.register(sessionPlugin, { secret: 'a secret with minimum length of 32 characters' })

  app.addHook('onRequest', (request, reply, done) => {
    request.session.language = 'it'
    done()
  })

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['session'],
    sessionKey: 'language'
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'Ciao!')
})

test('set language in session', async () => {
  const app = fastify()
  app.register(cookiePlugin)
  app.register(sessionPlugin, { secret: 'a secret with minimum length of 32 characters' })

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    languageDetectors: ['session']
  })

  app.get('/', (request, reply) => {
    return request.session.lng
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, 'en')
})

test('mulitple detectors are executed in array order', async () => {
  const app = fastify()
  app.register(acceptsPlugin)
  app.register(cookiePlugin)

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it', 'ar'],
    languageDetectors: ['query', 'cookie', 'accept']
  })

  app.get('/', (request, reply) => {
    return request.t('messages:hello')
  })

  {
    const res = await app.inject({
      path: '/',
      headers: { 'Accept-Language': 'it;q=1.0' }
    })
    equal(res.payload, 'Ciao!')
  }

  {
    const res = await app.inject({
      path: '/',
      headers: { 'Accept-Language': 'en;q=1.0' },
      cookies: { lng: 'en' }
    })
    equal(res.payload, 'Hello!')
  }

  {
    const res = await app.inject({
      path: '/?lng=ar',
      headers: { 'Accept-Language': 'en;q=1.0' },
      cookies: { lng: 'it' }
    })
    equal(res.payload, 'مرحبًا')
  }
})

test('do not set reply.locales if opts.decorateLocales is false', async () => {
  const app = fastify()

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it']
  })

  app.get('/', (request, reply) => {
    return reply.locales ?? {}
  })

  const res = await app.inject({ path: '/' })
  equal(res.payload, '{}')
})

test('set reply.locales if opts.decorateLocals is true', async () => {
  const app = fastify()

  app.register(plugin, {
    loadPath: join(__dirname, './fixtures/{{lng}}.{{ns}}.json'),
    fallbackLng: 'en',
    languages: ['en', 'it'],
    decorateLocals: true
  })

  app.get('/', (request, reply) => {
    return {
      msg: reply.locals.t('messages:hello'),
      keyExists: reply.locals.exists('messages:hello'),
      lng: request.lng,
      lngDir: request.lngDir,
      language: request.lng,
      languageDir: request.lngDir
    }
  })

  const res = await app.inject({ path: '/' })
  deepEqual(res.json(), {
    msg: 'Hello!',
    keyExists: true,
    lng: 'en',
    lngDir: 'ltr',
    language: 'en',
    languageDir: 'ltr'
  })
})
