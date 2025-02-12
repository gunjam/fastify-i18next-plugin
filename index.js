'use strict'

const assert = require('node:assert')
const { glob, readFile } = require('node:fs/promises')
const createI18nextInstance = require('i18next').createInstance
const fp = require('fastify-plugin')
const kDetected = Symbol('languageDetected')

/**
 * @param {Array} arr
 * @return {boolean}
 */
function isStringArray (arr) {
  return Array.isArray(arr) && arr.every(i => typeof i === 'string')
}

/**
 * @param {Iterable} items
 * @return {string}
 */
function list (items) {
  const arr = Array.from(items).sort()
  return `"${arr.slice(0, -1).join('", "')}" and "${arr.at(-1)}"`
}

/** @type {import('fastify').FastifyPluginAsync} */
async function i18nextPlugin (app, opts) {
  const {
    languages,
    loadPath,
    resources,
    decorateLocals = false,
    languageDetectors = [],
    defaultNS = false,
    param = 'lng',
    queryKey = 'lng',
    sessionKey = 'lng',
    cookieName = 'lng',
    cookieOpts = { path: '/', sameSite: true, httpOnly: true },
  } = opts

  const fallbackLng = opts.fallbackLng || languages?.[0]

  function paramDetector (request, reply, done) {
    if (request[kDetected] === false && languages.includes(request.params[param])) {
      request.setLanguage(request.params[param])
      request[kDetected] = true
    }
    done()
  }

  function queryDetector (request, reply, done) {
    if (request[kDetected] === false && languages.includes(request.query[queryKey])) {
      request.setLanguage(request.query[queryKey])
      request[kDetected] = true
    }
    done()
  }

  function sessionDetector (request, reply, done) {
    if (request[kDetected] === false && languages.includes(request.session[sessionKey])) {
      request.setLanguage(request.session[sessionKey])
      request[kDetected] = true
    }
    done()
  }

  function cookieDetector (request, reply, done) {
    if (request[kDetected] === false && languages.includes(request.cookies[cookieName])) {
      request.setLanguage(request.cookies[cookieName])
      request[kDetected] = true
    }
    done()
  }

  function acceptsDetector (request, reply, done) {
    if (request[kDetected] === false) {
      const lang = request.languages(languages)
      if (lang) {
        request.setLanguage(lang)
        request[kDetected] = true
      }
    }
    done()
  }

  function fallBack (request, reply, done) {
    if (request[kDetected] === false) {
      request.setLanguage(fallbackLng)
    }
    done()
  }

  function setLangInSession (request, reply, done) {
    request.session[sessionKey] = request.lng
    done()
  }

  function setLangCookie (request, reply, done) {
    if (request.lng !== request.cookies[cookieName]) {
      reply.setCookie(cookieName, request.lng, cookieOpts)
    }
    done()
  }

  async function loadResources (path, i18next) {
    const gPath = i18next.services.interpolator.interpolate(path, { lng: '*', ns: '*' })
    const regexPath = i18next.services.interpolator.interpolate(
      path
        // escape RegExp special chars
        .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
        .replaceAll('{{', '{{-'),
      {
        lng: '(?<lng>.*?)',
        ns: '(?<ns>.*?)'
      }
    ).replace(/[{}]/g, '\\$&')

    const meta = new RegExp(regexPath)

    for await (const file of glob(gPath)) {
      try {
        const { lng, ns } = file.match(meta).groups
        const data = await readFile(file, { encoding: 'utf-8' })
        i18next.addResourceBundle(lng, ns, JSON.parse(data))
      } catch (err) {
        app.log.error(err, `[fastify-i18next] failed to load resource ${file}`)
      }
    }
  }

  const detectors = new Map([
    ['param', paramDetector],
    ['query', queryDetector],
    ['session', sessionDetector],
    ['cookie', cookieDetector],
    ['accept', acceptsDetector]
  ])

  assert(loadPath === undefined || typeof loadPath === 'string', 'opts.loadPath must be a string path')
  assert(typeof decorateLocals === 'boolean', 'opts.decorateLocals must be a boolean')
  assert(typeof queryKey === 'string', 'opts.queryKey must be a string')
  assert(typeof sessionKey === 'string', 'opts.sessionKey must be a string')
  assert(typeof cookieName === 'string', 'opts.cookieName must be a string')
  assert(typeof param === 'string', 'opts.param must be a string')
  assert(isStringArray(languages), 'opts.languages must be an array of strings')
  assert(languages.length > 0, 'opts.languages must have at least one language')
  assert(opts.fallbackLng === undefined || typeof opts.fallbackLng === 'string', 'opts.fallbackLng must be a string language code')
  assert(languages.includes(fallbackLng), 'opts.fallbackLng must be a language code included in opts.languages')
  assert(isStringArray(languageDetectors), 'opts.languageDetectors must be an array of strings')
  assert(languageDetectors.every(ld => detectors.has(ld)), `opts.languageDetectors can only include ${list(detectors.keys())}`)
  assert(!languageDetectors.includes('cookie') || app.hasPlugin('@fastify/cookie'), 'The @fastify/cookie plugin must be registered to use the "cookie" detector')
  assert(!languageDetectors.includes('session') || app.hasPlugin('@fastify/session'), 'The @fastify/session plugin must be registered to use the "session" detector')
  assert(!languageDetectors.includes('accept') || app.hasPlugin('@fastify/accepts'), 'The @fastify/accepts plugin must be registered to use the "accept" detector')

  const i18next = createI18nextInstance()

  i18next.init({
    defaultNS,
    initAsync: false,
    supportedLngs: languages,
  })

  app.decorate('addI18nResource', i18next.addResourceBundle.bind(i18next))
  app.decorate('addI18nFormatter', i18next.services.formatter.add.bind(i18next.services.formatter))
  app.decorate('addI18nCachedFormatter', i18next.services.formatter.addCached.bind(i18next.services.formatter))
  app.decorate('getI18nFormatters', () => i18next.services.formatter.formats)
  app.decorate('loadI18nResources', async (path) => loadResources(path, i18next))

  if (resources) {
    for (const [lng, resource] of Object.entries(resources)) {
      for (const [ns, msgs] of Object.entries(resource)) {
        app.addI18nResource(lng, ns, msgs)
      }
    }
  }
  if (loadPath) {
    await app.loadI18nResources(loadPath)
  }

  function exists (key) {
    const nsIndex = key.indexOf(':')
    let msg = key
    let ns
    if (nsIndex !== -1) {
      msg = key.slice(nsIndex + 1)
      ns = key.slice(0, nsIndex)
    }
    return i18next.exists(msg, { ns, lng: this.lng })
  }

  // Get fixed language translator for each supported language, this avoids
  // cloning the i18next instance on every request which is very expensive.
  const locales = new Map()
  for (const lng of languages) {
    locales.set(lng, {
      t: i18next.getFixedT(lng),
      dir: i18next.dir(lng),
      lng,
    })
  }

  function serverT (key, lng, opts) {
    return (locales.get(lng) ?? locales.get(fallbackLng)).t(key, opts)
  }

  function setLanguage (language) {
    const locale = locales.get(language) ?? locales.get(fallbackLng)
    this.t = locale.t
    this.lng = locale.lng
    this.lngs = languages
    this.lngDir = locale.dir
  }

  function setLocales (request, reply, done) {
    reply.locals ??= Object.create(null)
    reply.locals.t = request.t
    reply.locals.exists = request.i18nKeyExists
    reply.locals.lng = request.lng
    reply.locals.lngDir = request.lngDir
    reply.locals.language = request.lng
    reply.locals.languageDir = request.lngDir
    reply.locals.lngs = request.lngs
    done()
  }

  function setContent (request, reply, payload, done) {
    reply.header('content-language', request.lng)
    done(null, payload)
  }

  app.decorate('t', serverT)
  app.decorateRequest(kDetected, false)
  app.decorateRequest('t', null)
  app.decorateRequest('lng', '')
  app.decorateRequest('lngs', null)
  app.decorateRequest('lngDir', '')
  app.decorateRequest('setLanguage', setLanguage)
  app.decorateRequest('i18nKeyExists', exists)

  for (const detector of languageDetectors) {
    app.addHook('onRequest', detectors.get(detector))
  }
  app.addHook('onRequest', fallBack)

  if (languageDetectors.includes('session')) {
    app.addHook('onRequest', setLangInSession)
  }
  if (languageDetectors.includes('cookie')) {
    app.addHook('onRequest', setLangCookie)
  }

  // if reply does not already have a locals property, add it as it is needed
  // in the i18n onRequest hook
  if (decorateLocals) {
    if (!app.hasReplyDecorator('locals')) {
      app.decorateReply('locals', null)
    }
    app.addHook('onRequest', setLocales)
  }
  app.addHook('onSend', setContent)
}

module.exports = fp(i18nextPlugin, {
  name: 'fastify-i18next',
})
