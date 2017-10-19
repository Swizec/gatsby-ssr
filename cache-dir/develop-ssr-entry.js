import React from "react"
import { renderToString, renderToStaticMarkup } from "react-dom/server"
import { StaticRouter, Route, withRouter } from "react-router-dom"
import { merge } from "lodash"

import apiRunner from "./api-runner-ssr"
import pages from "./pages.json"
import syncRequires from "./sync-requires"
import testRequireError from "./test-require-error"

let HTML
try {
  HTML = require(`../src/html`)
} catch (err) {
  if (testRequireError(`..\/src\/html`, err)) {
    HTML = require(`./default-html`)
  } else {
    console.log(`There was an error requiring "src/html.js"\n\n`, err, `\n\n`)
    process.exit()
  }
}

const getPage = path => pages.find(page => (
  page.path === path ||
  page.path.toLowerCase() === path ||
  page.path.toLowerCase() === path + `/`
))
const defaultLayout = props => <div>{props.children()}</div>

const getLayout = page => {
  const layout = syncRequires.layouts[page.layoutComponentChunkName]
  return layout ? layout : defaultLayout
}

const createElement = React.createElement

module.exports = ({ path }) => new Promise((resolve, reject) => {
  let bodyHtml = ``
  let headComponents = []
  let htmlAttributes = {}
  let bodyAttributes = {}
  let preBodyComponents = []
  let postBodyComponents = []
  let bodyProps = {}
  let htmlStr

  const replaceBodyHTMLString = body => {
    bodyHtml = body
  }

  const setHeadComponents = components => {
    headComponents = headComponents.concat(components)
  }

  const setHtmlAttributes = attributes => {
    htmlAttributes = merge(htmlAttributes, attributes)
  }

  const setBodyAttributes = attributes => {
    bodyAttributes = merge(bodyAttributes, attributes)
  }

  const setPreBodyComponents = components => {
    preBodyComponents = preBodyComponents.concat(components)
  }

  const setPostBodyComponents = components => {
    postBodyComponents = postBodyComponents.concat(components)
  }

  const setBodyProps = props => {
    bodyProps = merge({}, bodyProps, props)
  }

  const bodyComponent = createElement(
    StaticRouter,
    {
      location: {
        pathname: path,
      },
      context: {},
    },
    createElement(Route, {
      render: routeProps => {
        const page = getPage(routeProps.location.pathname)
        const layout = getLayout(page)
        return createElement(withRouter(layout), {
          children: layoutProps => {
            const props = layoutProps ? layoutProps : routeProps
            return createElement(
              syncRequires.components[page.componentChunkName],
              {
                ...props,
                ...syncRequires.json[page.jsonName],
              }
            )
          },
        })
      },
    })
  )

  // Let the site or plugin render the page component.
  apiRunner(`replaceRenderer`, {
    bodyComponent,
    replaceBodyHTMLString,
    setHeadComponents,
    setHtmlAttributes,
    setBodyAttributes,
    setPreBodyComponents,
    setPostBodyComponents,
    setBodyProps,
  })

  // If no one stepped up, we'll handle it.
  if (!bodyHtml) {
    bodyHtml = renderToString(bodyComponent)
  }

  apiRunner(`onRenderBody`, {
    setBodyAttributes,
    setBodyProps,
    setHeadComponents,
    setHtmlAttributes,
    setPostBodyComponents,
    setPreBodyComponents,
    pathname: path,
    bodyHtml,
  })

  const htmlElement = React.createElement(HTML, {
    ...bodyProps,
    body: bodyHtml,
    headComponents: headComponents.concat([
      <script key={`io`} src="/socket.io/socket.io.js" />,
    ]),
    preBodyComponents,
    postBodyComponents: postBodyComponents.concat([
      <script key={`commons`} src="/commons.js" />,
    ]),
    path,
  })
  htmlStr = renderToStaticMarkup(htmlElement)
  htmlStr = `<!DOCTYPE html>\n${htmlStr}`

  return resolve(htmlStr)
})
