import App from 'resource:///com/github/Aylur/ags/app.js'
import Utils from 'resource:///com/github/Aylur/ags/utils.js'

// Compile SASS
const sass = `${App.configDir}/sass/base.sass`
const css = `/tmp/ags/style.css`
Utils.exec(`sass ${sass} ${css}`)

const main = await import(`file://${App.configDir}/js/main.js`)
export default main.default