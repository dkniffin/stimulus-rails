// FIXME: es-module-shim won't shim the dynamic import without this explicit import
import "@hotwired/stimulus"

const controllerAttribute = "data-controller"

// Eager load all controllers registered beneath the `under` path in the import map to the passed application instance.
export function eagerLoadControllersFrom(under, application) {
  const paths = Object.keys(parseImportmapJson()).filter(path => path.match(new RegExp(`^${under}/.*_controller$`)))
  paths.forEach(path => registerControllerFromPath(path, under, application))
}

function parseImportmapJson() {
  return JSON.parse(document.querySelector("script[type=importmap]").text).imports
}

function registerControllerFromPath(path, under, application) {
  const name = path
    .replace(new RegExp(`^${under}/`), "")
    .replace("_controller", "")
    .replace(/\//g, "--")
    .replace(/_/g, "-")

  if (canRegisterController(name, application)) {
    import(path)
      .then(module => registerController(name, module, application))
      .catch(error => {
        if (error instanceof TypeError) {
          error.message = `Failed to register controller: ${name} (${path})`
        }

        throw error
      })
  }
}


// Lazy load controllers registered beneath the `under` path in the import map to the passed application instance.
export function lazyLoadControllersFrom(under, application, element = document) {
  const loadFn = controllerName => loadControllerBasedOnFilename(controllerName, under, application)
  lazyLoadExistingControllers(under, application, element, loadFn)
  lazyLoadNewControllers(under, application, element, loadFn)
}

function lazyLoadExistingControllers(element, loadFn) {
  queryControllerNamesWithin(element).forEach(loadFn)
}

function lazyLoadNewControllers(element, loadFn) {
  new MutationObserver((mutationsList) => {
    for (const { attributeName, target, type } of mutationsList) {
      switch (type) {
        case "attributes": {
          if (attributeName === controllerAttribute && target.getAttribute(controllerAttribute)) {
            extractControllerNamesFrom(target).forEach(loadFn)
          }
          break
        }

        case "childList": {
          lazyLoadExistingControllers(target, loadFn)
        }
      }
    }
  }).observe(element, { attributeFilter: [controllerAttribute], subtree: true, childList: true })
}

function queryControllerNamesWithin(element) {
  return Array.from(element.querySelectorAll(`[${controllerAttribute}]`)).map(extractControllerNamesFrom).flat()
}

function extractControllerNamesFrom(element) {
  return element.getAttribute(controllerAttribute).split(/\s+/).filter(content => content.length)
}

function loadControllerBasedOnFilename(name, under, application) {
  loadController(name, application, () => import(controllerFilename(name, under)))
}

function loadController(name, application, importFn) {
  if (canRegisterController(name, application)) {
    importFn()
      .then(module => registerController(name, module, application))
      .catch(error => console.error(`Failed to autoload controller: ${name}`, error))
  }
}

function controllerFilename(name, under) {
  return `${under}/${name.replace(/--/g, "/").replace(/-/g, "_")}_controller`
}

function registerController(name, module, application) {
  if (canRegisterController(name, application)) {
    application.register(name, module.default)
  }
}

function canRegisterController(name, application){
  return !application.router.modulesByIdentifier.has(name)
}

export function lazyLoadControllersFromConfig(config, application, element = document) {
  const loadFn = (controllerName) => {
    const importFn = config[controllerName]
    if (importFn) {
      loadController(controllerName, application, importFn)
    }
  }

  lazyLoadExistingControllers(element, loadFn)
  lazyLoadNewControllers(element, loadFn)
}
