# fastify-i18next-plugin

[![Coverage Status](https://coveralls.io/repos/github/gunjam/fastify-i18next-plugin/badge.svg?branch=main)](https://coveralls.io/github/gunjam/fastify-health-info?branch=main) [![neostandard javascript style](https://img.shields.io/badge/neo-standard-7fffff?style=flat\&labelColor=ff80ff)](https://github.com/neostandard/neostandard)

A simple plugin for using [i18next](https://www.i18next.com/) with [fastify](https://fastify.dev/).

## Install

```bash
npm install fastify-i18next-plugin
```

## Example

```javascript
import fastify from 'fastify'
import i18nPlugin from 'fastify-i18next-plugin'
const app = fastify()

app.register(i18nPlugin, {
  // Languages to support (required)
  languages: ['en', 'it'],
  resources: {
    // Lang
    en: {
      // i18next namespace
      messages: {
        // Key and message
        hello: 'Hello {{name}}'
      }
    },
    it: {
      messages: {
        hello: 'Ciao {{name}}'
      }
    }
  }
})

app.get('/en', (request, reply) => {
  // Set language of the messages returned from request.t()
  request.setLanguage('en')
  return request.t('messages:hello', { name: 'Daria' })
})

app.get('/it', (request, reply) => {
  // Set language of the messages returned from request.t()
  request.setLanguage('it')
  return request.t('messages:hello', { name: 'Daria' })
})

// Hello Daria
app.inject('/en')
  .then(res => console.log(res.payload))

// Ciao Daria
app.inject('/it')
  .then(res => console.log(res.payload))
```

## Loading JSON resources from disk

Proving a path pattern to `opts.loadPath` will allow you load JSON locale files
from disk. The path must include `{{ns}}` and `{{lng}}` patterns so that the
namespace and language of the resource can be determined.

For example given the following structure:

```
└ locales/
    ├ en/
    │ ├ messages.json
    │ └ greetings.json
    └ it/
      ├ messages.json
      └ greetings.json
```

The path `./locales/{{lng}}/{{ns}}.json` will load the `messages.json` and
`greetings.json` files to the messages and greetings namespaces for English and
Italian.

Eg:

```jsonc
// ./locales/it/greetings.json
{
  "nested": {
    "hello": "Ciao!"
  }
}
```

```javascript
import { join } from 'node:path'
import fastify from 'fastify'
import i18nPlugin from 'fastify-i18next-plugin'
const app = fastify()

await app.register(i18nPlugin, {
  languages: ['en', 'it'],
  // Will load: ./locales/en/greetings.json, ./locales/it/greetings.json
  // setting the langues from the path and namespace from the filename
  loadPath: join(import.meta.dirname, './locales/{{lng}}/{{ns}}.json')
})

// Ciao!
console.log(app.t('greetings:nested.hello', 'it'))
```

## Loading resources within another plugin

You can still load resources after the plugin is registered using the
`fastify.addI18nResource()` and `fastify.loadI18nResources()` functions.

```javascript
import fastify from 'fastify'
import i18nPlugin from 'fastify-i18next-plugin'
const app = fastify()

app.register(i18nPlugin, {
  languages: ['en', 'it']
})

app.register((instance) => {
  instance.addI18nResource('en', 'greeting', { hello: 'Hello' })
  instance.addI18nResource('it', 'greeting', { hello: 'Ciao' })
  instance.loadI18nResources('./locales/{{lng}}.{{ns}}.json')
  instance.log.info(instance.t('greeting:hello', 'en'))
})
```

## Adding i18next formatters

Use the `fastify.addI18nFormatter()` and  `fastify.addI18nCachedFormatter()`
functions to add i18next formatters. See the [i18next formatting documention](https://www.i18next.com/translation-function/formatting)
for more info about their usage.

```javascript
import fastify from 'fastify'
import i18nPlugin from 'fastify-i18next-plugin'
const app = fastify()

await app.register(i18nPlugin, {
  languages: ['en', 'it'],
  resources: {
    en: {
      messages: {
        hello: 'Hello {{name, upper}}',
        helloAll: 'Hello {{names, list}}'
      }
    }
  }
})

app.addI18nFormatter('upper', (val) => val.toUpperCase())
app.addI18nCachedFormatter('list', (lng) => {
  const formatter = new Intl.ListFormat(lng, {
    style: 'long',
    type: 'conjunction',
  })
  return (val) => formatter.format(val)
})

// Hello DARIA
app.t('messages:hello', 'en', { name: 'Daria' })

// Hello Niall, James, and Tim
app.t('messages:helloAll', 'en', { names: ['Niall', 'James', 'Tim'] })
```

## Detecting the language for the request

Setting the `languageDetectors` option will add a hook to set the language from
any or all of the follwing, a URL path parameter, query string, cookie, session
or accept header. The detectors will be exector in array order and stop as
soon as a supported language is found.

When using either the session or cookie detectors, the detected language will
be persisted in the session or cookie.

```javascript
import fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import i18nPlugin from 'fastify-i18next-plugin'
const app = fastify()

app.register(cookiePlugin)
app.register(i18nPlugin, {
  fallbackLng: 'en',
  languages: ['en', 'it', 'cy'],
  languageDetectors: ['query', 'cookie']
})

app.get('/', (request, reply) => {
  return request.lng
})

// 'en', fallback language
app.inject('/').then(res => console.log(res.payload))

// 'it', detected from lng cookie
app.inject({
  path: '/',
  cookies: { lng: 'it' }
})
  .then(res => console.log(res.payload))

// 'cy', detected from lng query, cookie won't be checked as it is lower
// priority
app.inject({
  path: '/',
  query: { lng: 'cy' },
  cookies: { lng: 'it' }
})
  .then(res => console.log(res.payload))
```

# Plugin options

* `fallbackLng` (String): The default language code to use. Default: the first language it the `languages` array.
* `languages` (Array): List of language codes to support, trying to change to a lanuage not in the list will set to the fallback language.
* `resources` (Object): Object map of locale messages, in the format `{ lang: { namespace: { key: message } } }`.
* `loadPath` (String): Path to load JSON file resources from, namespace and language are determined from path parameters, eg: `./locales/{{lng}}/{{ns}}.json`.
* `languageDetectors` (Array): A list of language selectors to use, will be checked in order until a supported language is detected. Can be one to many of the following:
  * `"query"`: Detect language from query string. Default query: 'lng'.
  * `"param"`: Detect language from parsed URL path parameter (eg: request.params.lng).
  * `"accept"`: Detect language from [language accept header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language). Note: the [@fastify/accepts](https://github.com/fastify/fastify-accepts) plugin must be loaded to use this detector.
  * `"cookie"`: Detect language from cookie value (will also persist any detected language to this cookie). Note: the [@fastify/cookie](https://github.com/fastify/fastify-cookie) plugin must be loaded to use this detector.
  * `"session"`: Detect language from sesion value (will also persist any detected language to this sesion property). Note: the [@fastify/session](https://github.com/fastify/session) plugin must be loaded to use this detector.
* `queryKey` (String): The query value to use for the `query` language detector. Default: `lng`.
* `param` (String): The path paramter to use for the `param` language detector. Default: `lng`.
* `sessionKey` (String): The session property to use for the `session` language detector. Default: `lng`.
* `cookieName` (String): The cookie to use for the `cookie` language detector. Default: `lng`.
* `cookieOpts` (Object): The cookie options to use when setting the language cookie. See the [@fastify/cookie](https://github.com/fastify/fastify-cookie) options for more details. Default: `{ path: '/', sameSite: true, httpOnly: true }`
* `decorateLocals` (Boolean): Decorate reply.locals with language properties and `t()` for use in templates, for example when using [@fastify/view](https://github.com/fastify/point-of-view).

# Server decorators

```javascript
app.t('namespace:key') // Get a message for the fallback language
app.t('namespace:key', opts) // Get a message with options object, eg data to interpolate
app.addI18nFormatter('name', func) // Add an i18next formatter
app.addI18nCachedFormatter('name', func) // Add an i18next cached formatter
app.addI18nResource('lang', 'namespace', { key: 'Message' }) // Add new locales messages
app.loadI18nResources('./locales/{{lng}}.{{ns}}.json') // Load JSON locales files from a path pattern
```

# Request decorators

```javascript
app.get('/', (request, reply) => {
  request.setLanguage('en') // Sets language to English
  request.lng // The currently set language code
  request.lngDir // Direction of current language, eg: 'ltr', 'rtl'
  request.lngs // The currently support languages, eg: ['en', 'it']
  request.t('messages:hello') // Get a message for the current language
  request.i18nKeyExists('messages:hello') // Returns true if given key has a value
})
```

# reply.locals properties (if `decorateLocals` is `true`)

```javascript
app.get('/', (request, reply) => {
  reply.locals.t('messages:hello') // same as request.t
  reply.locals.exists('messages:hello') // same as request.i18nKeyExists
  reply.locals.lngs // same as request.lngs
  reply.locals.lng // same as request.lng
  reply.locals.lngDir // same as request.lngDir
  reply.locals.language // same as request.lng
  reply.locals.languageDir // same as request.lngDir
})
```
