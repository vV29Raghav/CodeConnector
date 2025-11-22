import logo from './logo.svg';
import './App.css';
import {BrowserRouter, Routes, Route} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import EditorPage from './pages/EditorPage';

function App() {
  return (
    <>
      <Toaster position='top-right' toastOptions={{
        success: {
          theme: {
            primary: '#4aed88',
          }
        }
      }}/>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Home />} />  {/*Here element is prop that takes component to be rendered*/}
          <Route path='/editor/:roomId' element={<EditorPage />} /> {/* :roomId is a dynamic route */}
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
