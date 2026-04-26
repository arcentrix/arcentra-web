import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { useTheme } from '@/hooks/use-theme'
import AuthGuard from '@/components/Layouts/AuthGuard'
import DefaultLayouts from '@/components/Layouts/default'
import DockLayout from '@/components/Layouts/dock-layout'
import Login from './Login'
import Register from './Register'
import Dashboard from './Dashboard'
import ProjectsOverview from './Project/Overview'
import ProjectDetail from './Projects/Detail'
import ProjectDetailOverview from './Projects/Detail/Overview'
import ProjectPipelines from './Project/Pipelines'
import PipelineDetail from './Project/Pipelines/Detail'
import PipelineHistory from './Project/Pipelines/History'
import ProjectDeployments from './Project/Deployments'
import ProjectArtifacts from './Project/Artifacts'
import ProjectEnvironments from './Project/Environments'
import ProjectSecrets from './Project/Secrets'
import ProjectSettings from './Project/Settings'
import ProjectMembers from './Project/Members'
import AgentsOverview from './Models/Agents/Overview'
import AgentsDetail from './Models/Agents/Detail'
import Build from './Build'
import Deploy from './Deploy'
import Observe from './Observe'
import Secure from './Secure'
import Identity from './Identity'
import Users from './Users'
import Roles from './Roles'
import Settings from './Settings'
import SettingsNotifications from './Settings/Notifications'
import SettingsSystemInfo from './Settings/SystemInfo'
import Access from './Access'
import GeneralSettings from './GeneralSettings'
import { AuthCallback } from './AuthCallback'
import LLMDialogueChat from './LLMDialogue/Chat'
import LLMDialogueHistory from './LLMDialogue/History'
import Inbox from './Inbox'
import NotFound from './NotFound'
import 'react-toastify/dist/ReactToastify.css'

function App() {
  const { resolvedTheme } = useTheme()

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<DefaultLayouts />}>
            <Route element={<AuthGuard />}>
              <Route element={<DockLayout />}>
                <Route element={<Dashboard />} index path='/' />
                <Route element={<Build />} path='/build' />
                <Route element={<Deploy />} path='/deploy' />
                <Route element={<Observe />} path='/observe' />
                <Route element={<Secure />} path='/secure' />
                <Route element={<ProjectsOverview />} path='/projects' />
                <Route element={<ProjectDetail />} path='/projects/:projectId'>
                  <Route index element={<ProjectDetailOverview />} />
                  <Route element={<ProjectPipelines />} path='pipelines' />
                  <Route element={<PipelineHistory />} path='pipelines/runs' />
                  <Route element={<PipelineDetail />} path='pipelines/:id' />
                  <Route element={<ProjectDeployments />} path='deployments' />
                  <Route element={<ProjectArtifacts />} path='artifacts' />
                  <Route element={<ProjectEnvironments />} path='environments' />
                  <Route element={<ProjectSecrets />} path='secrets' />
                  <Route element={<ProjectSettings />} path='settings' />
                  <Route element={<ProjectMembers />} path='members' />
                </Route>
                <Route element={<AgentsOverview />} path='/agents' />
                <Route element={<AgentsDetail />} path='/agents/:id' />
                <Route element={<Access />} path='/access' />
                <Route element={<Users />} path='/users' />
                <Route element={<Roles />} path='/roles' />
                <Route element={<Identity />} path='/identity-integration' />
                <Route element={<Settings />} path='/settings' />
                <Route element={<SettingsNotifications />} path='/settings/notifications' />
                <Route element={<SettingsSystemInfo />} path='/settings/system-info' />
                <Route element={<GeneralSettings />} path='/general-settings' />
                <Route element={<Inbox />} path='/inbox' />
                <Route element={<LLMDialogueChat />} path='/workspace/:workspaceName/chat' />
                <Route element={<LLMDialogueHistory />} path='/workspace/:workspaceName/history' />
              </Route>
            </Route>
            <Route element={<Login />} path='/login' />
            <Route element={<Register />} path='/register' />
            <Route element={<AuthCallback />} path='/auth/callback/:type' />
            <Route element={<NotFound />} path='*' />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        icon={false}
        toastClassName='border rounded-lg shadow-lg text-sm'
      />
    </>
  )
}

export default App
