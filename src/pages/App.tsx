import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import AuthGuard from '@/components/Layouts/AuthGuard'
import DefaultLayouts from '@/components/Layouts/default'
import Login from './Login'
import Register from './Register'
import Dashboard from './Dashboard'
import { AuthCallback } from './AuthCallback'
import 'react-toastify/dist/ReactToastify.css'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<DefaultLayouts />}>
            <Route element={<AuthGuard />}>
              <Route element={<Dashboard />} index path='/' />
            </Route>
            <Route element={<Login />} path='/login' />
            <Route element={<Register />} path='/register' />
            <Route element={<AuthCallback />} path='/auth/callback/:type' />
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
        theme='light'
        icon={false}
        toastClassName='border rounded-lg shadow-lg'
        bodyClassName='text-sm'
      />
    </>
  )
}

export default App
