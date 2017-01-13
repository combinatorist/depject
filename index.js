var N = require('libnested')

function isString (s) {
  return typeof s === 'string'
}

function isEmpty (e) {
  for (var k in e) return false
  return true
}

function isFunction (f) {
  return typeof f === 'function'
}

var apply = require('./apply')

function filter (modules, fn) {
  if (Array.isArray(modules)) {
    return modules.filter(fn)
  }
  var o = {}
  for (var k in modules) {
    if (fn(modules[k], k, modules)) {
      o[k] = modules[k]
    }
  }
  return o
}

function append (obj, path, value) {
  var a = N.get(obj, path)
  if (!a) N.set(obj, path, a = [])
  a.push(value)
}

module.exports = function combine () {
  // iterate over array, and collect new plugs which are satisfyable.

  var modules = [].slice.call(arguments).reduce(function (a, b) {
    for (var k in b) {
      if (!b[k]) delete a[k]
      else a[k] = b[k]
    }
    return a
  }, {})

  var allNeeds = {}
  var allGives = {}

  for (var k in modules) {
    var module = modules[k]
    N.each(module.needs, function (v, path) {
      N.set(allNeeds, path, true)
    })
    if (isString(module.gives)) {
      N.set(allGives, [module.gives], true)
    } else {
      N.each(module.gives, function (v, path) {
        N.set(allGives, path, true)
      })
    }
  }

  N.each(allNeeds, function (_, path) {
    if (!N.get(allGives, path)) { throw new Error('export needed but not given' + path.join('.') + ' in: ' + path) }
  })

//  console.log("NEEDS", allNeeds)
//  console.log("GIVES", allGives)

  // okay, instead of iterating over everything, in dependency order.
  // just create things in order added?

  var sockets = {}
  while (true) {
    var newSockets = {}
    // filter modules that have not been resolved yet.
    modules = filter(modules, function (module, key) {
      // if this module cannot be resolved yet, keep it for next time.
      // collect the functions that this module needs.
      var m = N.map(module.needs, function (type, path) {
        var a = N.get(sockets, path)
        if (!a) {
          a = N.set(sockets, path, [])
        }
        return apply[type](a)
      })

      // create module, and get function(s) it returns.
      if (!isFunction(module.create)) {
        throw new Error('module:' + key + ' did not have a create function')
      }
      var exported = module.create(m)

      // for the functions it declares, merge these into newSockets
      if (isString(module.gives)) {
        append(newSockets, [module.gives], exported)
      } else {
        N.each(module.gives, function (_, path) {
          var fun = N.get(exported, path)
          if (!isFunction(fun)) { throw new Error('export declared but not returned' + path.join('.') + ' in:' + key) }
          append(newSockets, path, fun)
        })
      }
    })

    if (isEmpty(newSockets)) {
      throw new Error('could not resolve all modules')
    } else {
      N.each(newSockets, function (_ary, path) {
        var ary = N.get(sockets, path) || N.set(sockets, path, [])
        _ary.forEach(function (e) { ary.push(e) })
      })
    }
    if (isEmpty(modules)) { return sockets }
  }
}

