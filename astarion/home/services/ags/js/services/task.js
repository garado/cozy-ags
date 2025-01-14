
/* ▀█▀ ▄▀█ █▀ █▄▀ █░█░█ ▄▀█ █▀█ █▀█ █ █▀█ █▀█ */
/* ░█░ █▀█ ▄█ █░█ ▀▄▀▄▀ █▀█ █▀▄ █▀▄ █ █▄█ █▀▄ */

/* Interface between TaskWarrior and ags config. */

import Utils from 'resource:///com/github/Aylur/ags/utils.js'
import UserConfig from '../../userconfig.js'

/*************************************************
 * MODULE-LEVEL VARIABLES
/*************************************************/

const CONTEXT_SET = "task context todo > /dev/null ;"
const CONTEXT_UNSET = ""

/*************************************************
 * SERVICE DEFINITION
/*************************************************/

class TaskService extends Service {
  static {
    Service.register (
      this,

      /* Signals */
      {
        /* Emitted when tasks for a tag + project have been fetched. 
         * Format: { tag, project } */
        'fetch-finished':  ['string', 'string'],
      },

      /* Properties */
      {
        /* Name of the currently selected tag. */
        'active-tag':     ['string', 'rw'],

        /* Name of the currently selected project. */
        'active-project': ['string', 'rw'],

        /* jsobject for currently selected task. */
        'active-task':    ['jsobject', 'rw'],

        /* Array of currently active tags. */
        'tags':           ['jsobject', 'r'],
        
        /* Array of projects for the currently active tag. */
        'projects-in-active-tag': ['jsobject', 'r'],

        /* Array of tasks for... guess. */
        'tasks-in-active-tag-project': ['jsobject', 'r'],

        /* Makes #taskData available publicly. */
        'task-data':      ['jsobject', 'r'],

        /* Either 'add' or 'modify'. */
        'popup-mode':    ['string', 'rw'],
      },
    )
  }

  constructor(taskdata) {
    globalThis.log('taskService', 'Constructing task service')

    super()
    this.#taskDataDirectory = taskdata
    this.#initData()

    // A taskwarrior hook sets this externally when a task is added or modified
    // The hook contains:
    //    ags -r "taskDataUpdated.setValue(0)"
    globalThis.taskDataUpdated = Variable(0)
    
    taskDataUpdated.connect('changed', () => {
      log('taskService', 'Task data has changed')
      this.#savedActiveProject = this.#activeProject
      this.#savedActiveTag = this.#activeTag
      this.#initData()
    })
  }


  /*********************************
   * PRIVATE VARIABLES
   *********************************/

  #taskDataDirectory = ''
  #taskData = {}

  #activeTag = ''
  #activeProject = ''
  #activeTask = {}

  #tags = []
  #projectsInActiveTag = []
  #tasksInActiveTagProject = []
  
  #savedActiveTag = ''
  #savedActiveProject = ''

  #popupMode = 'modify'

  /***********************************************
   * GETTERS/SETTERS
   * These allow things outside of the service 
   * to access the service's private variables
   ***********************************************/

  get tags() {
    return this.#tags
  }

  get projects_in_active_tag() {
    return this.#projectsInActiveTag
  } 

  get tasks_in_active_tag_project() {
    return this.#tasksInActiveTagProject
  } 

  set popup_mode(mode) {
    this.#popupMode = mode
    this.changed('popup-mode')
  }
  
  get popup_mode() {
    return this.#popupMode
  }

  get task_data() {
    return this.#taskData
  } 
  
  get active_tag() {
    return this.#activeTag
  } 

  set active_tag(tag) {
    if (tag == this.#activeTag) return
    this.#activeTag = tag
    this.#activeProject = Object.keys(this.#taskData[tag])[0]
    this.#projectsInActiveTag = Object.keys(this.#taskData[tag])

    this.changed('active-tag')
    this.changed('active-project')
    this.changed('projects-in-active-tag')

    this.#fetchTasks()
  } 
  
  get active_project() {
    return this.#activeProject
  } 
  
  set active_project(project) {
    if (project == this.#activeProject) return
    this.#activeProject = project
    this.changed('active-project')
    this.#fetchTasks()
  } 

  get active_task() {
    return this.#activeTask
  }
  
  set active_task(t) {
    this.#activeTask = t
    this.changed('active-task')
  }

  /*********************************
   * PUBLIC FUNCTIONS
   *********************************/

  /**
   * Get tasks for a given tag and project.
   */
  queryTasks(tag, project) {
    if (this.#taskData[tag] && this.#taskData[tag][project]) {
      return this.#taskData[tag][project]
    }
  }

  /**
   * Executes `task mod` or `task add`.
   */
  execute(tdata) {
    let cmd = ''
    if (this.#popupMode == 'add') {
      cmd += CONTEXT_SET
      cmd += `task rc.data.location="${this.#taskDataDirectory}" add `
      cmd += `tag:"${tdata.tags[0]}" project:"${tdata.project}" due:"${tdata.due}" `
      cmd += `description:"${tdata.description}" `
      cmd += CONTEXT_UNSET
    } else if (this.#popupMode == 'modify') {
      cmd += CONTEXT_SET
      cmd  = `task rc.data.location="${this.#taskDataDirectory}" uuid:"${tdata.uuid}" mod `
      cmd += `tag:"${tdata.tags[0]}" project:"${tdata.project}" due:"${tdata.due}" `
      cmd += `description:"${tdata.description}" `
      cmd += CONTEXT_UNSET
    }

    Utils.execAsync(`bash -c '${cmd}'`)
      .then(out => print(out))
      .catch(err => log)
  }


  /**
   * Executes `task delete` for the currently active task.
   */
  delete() {
    if (this.#activeTask.uuid) {
      const cmd = `echo 'yes' | ${CONTEXT_SET} task rc.data.location="${this.#taskDataDirectory}" delete ${this.#activeTask.uuid}`
      Utils.execAsync(`bash -c '${cmd}'`)
        .then(out => print(out))
        .catch(err => log)
    }
  }

  done() {
    if (this.#activeTask.uuid) {
      const cmd = `echo 'yes' | ${CONTEXT_SET} task rc.data.location="${this.#taskDataDirectory}" done ${this.#activeTask.uuid}`
      Utils.execAsync(`bash -c '${cmd}'`)
        .then(out => print(out))
        .catch(err => log)
    }
  }

  undo() {

  }

  /*********************************
   * PRIVATE FUNCTIONS
   *********************************/

  #initData() {
    this.#initTags()
  }

  /**
   * @brief Fetch initial list of tags from TaskWarrior.
   * @note _unique is cleaner, but I can't use it because it doesn't respect contexts :/
   **/
  #initTags() {
    const cmd = `${CONTEXT_SET} task rc.data.location='${this.#taskDataDirectory}' status:pending tags ${CONTEXT_UNSET}`
    Utils.execAsync(['bash', '-c', cmd])
      .then(out => {
        const raw = out.split('\n')
        const raw_1 = raw.filter(element => /\d/.test(element));
        const tags = raw_1.map(item => item.split(' ')[0]);

        this.#tags = tags

        tags.map(tagName => {
          this.#taskData[tagName] = {}

          if (this.#activeTag == '') {
            this.#activeTag = tagName
          }

          this.#initProjects(tagName)
        })

      })
      .catch(err => print(err))
  }

  /**
  * @brief Fetch projects for a given tag.
  **/
  #initProjects(tag) {
    const cmd = `${CONTEXT_SET} task rc.data.location='${this.#taskDataDirectory}' tag:'${tag}' status:pending _unique project ${CONTEXT_UNSET}`
    Utils.execAsync(['bash', '-c', cmd])
      .then(out => {
        const projects = out.split('\n')

        projects.map(project => {

          if (project == undefined) {
            project = '(none)'
          }

          if (this.#activeTag == tag && this.#activeProject == '') {
            this.#activeProject = project
            this.#projectsInActiveTag = projects
          }

          this.#fetchTasks(tag, project)

          this.#taskData[tag][project] = {}
        })
      })
      .catch(err => log(`TaskService: initProjects: ${err}`))
  }

  /**
   * @brief Fetch tasks for a given tag and project.
   **/
  #fetchTasks(t = this.#activeTag, p = this.#activeProject) {
    const p_cmd = p || ''
    const cmd = `${CONTEXT_SET} task status:pending tag:'${t}' project:'${p_cmd}' rc.data.location='${this.#taskDataDirectory}' export`

    Utils.execAsync(['bash', '-c', cmd])
      .then(out => {
        const tasks = JSON.parse(out)

        // Sort by due date, then by title
        tasks.sort((a, b) => {
          if (a.due == undefined && b.due == undefined) {
            return a.description > b.description
          }

          else if (a.due != undefined && b.due == undefined) {
            return -1
          }
          
          else if (a.due == undefined && b.due != undefined) {
            return 1
          }
          
          else if (a.due != undefined && b.due != undefined) {
            return a.due > b.due
          }
        })

        this.#taskData[t][p].tasks = tasks

        if (t == this.#activeTag && p == this.#activeProject) {
          this.#tasksInActiveTagProject = tasks
          this.#activeTask = this.#tasksInActiveTagProject[0]
          this.changed('tasks-in-active-tag-project')
          this.changed('active-task')
        }

        this.emit('fetch-finished', t, p)
      })
      .catch(err => log(`TaskService: fetchTasks: ${err}`))
  }
}

const service = new TaskService(UserConfig.task.directory)
export default service
